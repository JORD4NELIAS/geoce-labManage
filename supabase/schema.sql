-- ==============================================================================
-- GEOCE LabLicence — Supabase PostgreSQL Database Schema
-- Inclui: Perfis, Máquinas, Reservas FIFO, Fair Sharing Trigger, Views e RLS
-- ==============================================================================

-- Habilitação de extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums do Sistema
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'researcher', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE machine_status AS ENUM ('available', 'in_use', 'maintenance', 'offline');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reservation_status AS ENUM ('queued', 'approved', 'active', 'completed', 'cancelled', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE workload_category AS ENUM ('deep_learning', 'data_science', 'cad_3d', 'general_compilation', 'testing');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Perfis de Usuários
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role user_role DEFAULT 'student',
    weekly_hours_limit INT DEFAULT 20, -- Cota Fair Sharing configurável por usuário (padrão 20h)
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Máquinas e Perfis de Hardware
CREATE TABLE IF NOT EXISTS public.machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_name TEXT NOT NULL UNIQUE,       -- Ex: "GEOCE-GPU-01", "LAB-WORKSTATION-04"
    specs JSONB NOT NULL,                 -- Ex: {"gpu": "RTX 4090", "vram_gb": 24, "cpu_cores": 32, "ram_gb": 64}
    status machine_status DEFAULT 'available',
    is_exclusive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Reservas, Fila FIFO e Alocação
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE RESTRICT,
    purpose TEXT NOT NULL,
    workload_type workload_category DEFAULT 'general_compilation',
    status reservation_status DEFAULT 'queued',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_hours NUMERIC(4, 2) GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 3600
    ) STORED,
    requested_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()), -- Critério FIFO
    cancelled_by UUID REFERENCES public.profiles(id),
    cancelled_at TIMESTAMPTZ,
    check_in_at TIMESTAMPTZ
);

-- Índices de Alta Performance para a Fila FIFO
CREATE INDEX IF NOT EXISTS idx_reservations_fifo ON public.reservations(machine_id, status, requested_at ASC);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON public.reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_period ON public.reservations(start_time, end_time);

-- 4. Função de Validação: Fair Sharing & Limite de Cotas Semanais
CREATE OR REPLACE FUNCTION check_user_fair_share_quota()
RETURNS TRIGGER AS $$
DECLARE
    current_weekly_hours NUMERIC;
    user_limit INT;
    requested_duration NUMERIC;
BEGIN
    -- Obter cota semanal configurada do usuário (ou padrão de 20h)
    SELECT COALESCE(weekly_hours_limit, 20) INTO user_limit FROM public.profiles WHERE id = NEW.user_id;

    -- Calcular duração solicitada em horas
    requested_duration := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600;

    -- Validar se a data final é maior que a inicial
    IF requested_duration <= 0 THEN
        RAISE EXCEPTION 'A data de término deve ser posterior à data de início.';
    END IF;

    -- Validar duração máxima de uma única sessão (máximo 4 horas contínuas)
    IF requested_duration > 4.0 THEN
        RAISE EXCEPTION 'Regra de Fair Sharing: Sessões não podem exceder 4 horas contínuas.';
    END IF;

    -- Calcular total já consumido ou agendado na semana corrente (últimos 7 dias)
    SELECT COALESCE(SUM(duration_hours), 0)
    INTO current_weekly_hours
    FROM public.reservations
    WHERE user_id = NEW.user_id
      AND status IN ('queued', 'approved', 'active', 'completed')
      AND start_time >= (NOW() - INTERVAL '7 days');

    IF (current_weekly_hours + requested_duration) > user_limit THEN
        RAISE EXCEPTION 'Limite de Cota Semanal Excedido: Você já utilizou %h das %h permitidas nesta semana.', 
            current_weekly_hours, user_limit;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_quota ON public.reservations;
CREATE TRIGGER trg_validate_quota
BEFORE INSERT ON public.reservations
FOR EACH ROW
WHEN (NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL)
EXECUTE FUNCTION check_user_fair_share_quota();

-- 5. View Agregada para Exportação de Métricas
CREATE OR REPLACE VIEW public.vw_lab_metrics AS
SELECT 
    m.id AS machine_id,
    m.code_name AS machine_name,
    m.specs->>'gpu' AS gpu_model,
    m.specs->>'vram_gb' AS vram_gb,
    COUNT(r.id) AS total_reservations,
    ROUND(COALESCE(SUM(r.duration_hours), 0), 2) AS total_hours_allocated,
    ROUND(COALESCE(AVG(r.duration_hours), 0), 2) AS avg_session_duration_hours,
    COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END) AS total_cancellations,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS total_completed
FROM public.machines m
LEFT JOIN public.reservations r ON m.id = r.machine_id
GROUP BY m.id, m.code_name, m.specs;

-- 6. Habilitar Realtime para a tabela de reservas
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.machines;

-- 7. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Políticas de Profiles
DROP POLICY IF EXISTS "Perfis visíveis para autenticados" ON public.profiles;
CREATE POLICY "Perfis visíveis para autenticados" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuário atualiza seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuário atualiza seu próprio perfil" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Políticas de Máquinas
DROP POLICY IF EXISTS "Máquinas visíveis para autenticados" ON public.machines;
CREATE POLICY "Máquinas visíveis para autenticados" ON public.machines FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins gerenciam máquinas" ON public.machines;
CREATE POLICY "Admins gerenciam máquinas" ON public.machines FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Políticas de Reservas
DROP POLICY IF EXISTS "Fila visível publicamente a usuários autenticados" ON public.reservations;
CREATE POLICY "Fila visível publicamente a usuários autenticados" ON public.reservations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuário cria sua própria reserva" ON public.reservations;
CREATE POLICY "Usuário cria sua própria reserva" ON public.reservations FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Cancelamento por Dono ou Admin" ON public.reservations;
CREATE POLICY "Cancelamento por Dono ou Admin" ON public.reservations FOR UPDATE TO authenticated
USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (status = 'cancelled');

-- 8. Seed Inicial de Máquinas para Demonstração do Laboratório
INSERT INTO public.machines (code_name, specs, status, is_exclusive)
VALUES 
    ('GEOCE-NODE-01', '{"gpu": "NVIDIA RTX 4090", "vram_gb": 24, "cpu_cores": 32, "ram_gb": 64, "storage": "2TB NVMe"}', 'available', false),
    ('GEOCE-NODE-02', '{"gpu": "NVIDIA A100 Tensor Core", "vram_gb": 80, "cpu_cores": 64, "ram_gb": 128, "storage": "4TB NVMe"}', 'in_use', true),
    ('GEOCE-NODE-03', '{"gpu": "NVIDIA RTX 3090 Ti", "vram_gb": 24, "cpu_cores": 24, "ram_gb": 64, "storage": "2TB NVMe"}', 'available', false),
    ('GEOCE-WORKSTATION-04', '{"gpu": "NVIDIA RTX 4080", "vram_gb": 16, "cpu_cores": 16, "ram_gb": 32, "storage": "1TB NVMe"}', 'maintenance', false)
ON CONFLICT (code_name) DO NOTHING;
