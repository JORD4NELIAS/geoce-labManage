-- ==============================================================================
-- GEOCE LabManage — Supabase PostgreSQL Database Schema
-- Inclui: Perfis, Máquinas, Reservas FIFO, Auditoria Imutável, Fair Sharing e RLS
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

-- 1. Perfis de Usuários (Com suporte a Soft Delete)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role user_role DEFAULT 'student',
    weekly_hours_limit INT DEFAULT 20,    -- Cota Fair Sharing configurável por usuário (padrão 20h)
    is_active BOOLEAN DEFAULT TRUE,        -- Flag de Soft Delete (permite desativar sem apagar dados)
    deleted_at TIMESTAMPTZ,                -- Data de desativação/exclusão lógica
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Máquinas e Perfis de Hardware
CREATE TABLE IF NOT EXISTS public.machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_name TEXT NOT NULL UNIQUE,       -- Ex: "GEOCE-NODE-01", "GEOCE-NODE-02"
    specs JSONB NOT NULL,                 -- Ex: {"gpu": "RTX 3060", "vram_gb": 12, "cpu_cores": 32, "ram_gb": 64}
    status machine_status DEFAULT 'available',
    is_exclusive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Reservas, Fila FIFO e Histórico de Alocação
-- PROTEÇÃO CONTRA CASCADE: ON DELETE SET NULL preserva todo o histórico do laboratório
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Se o perfil for removido, o histórico de uso permanece
    user_email_snapshot TEXT,                                       -- Snapshot permanente do e-mail do usuário
    machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE RESTRICT,
    purpose TEXT NOT NULL,
    workload_type workload_category DEFAULT 'general_compilation',
    status reservation_status DEFAULT 'queued',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_hours NUMERIC(4, 2) GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 3600
    ) STORED,
    requested_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),        -- Critério FIFO
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ,
    check_in_at TIMESTAMPTZ
);

-- Índices de Alta Performance para a Fila FIFO e Consultas
CREATE INDEX IF NOT EXISTS idx_reservations_fifo ON public.reservations(machine_id, status, requested_at ASC);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON public.reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_period ON public.reservations(start_time, end_time);

-- 4. Tabela de Auditoria e Histórico Permanente de Acessos (Append-Only / Imutável)
CREATE TABLE IF NOT EXISTS public.access_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_email TEXT,                          -- Snapshot do e-mail para histórico perpétuo
    machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
    action TEXT NOT NULL,                     -- Ex: 'login', 'logout', 'session_start', 'session_end', 'reservation_created', 'reservation_status_changed'
    ip_address TEXT,                          -- IP de origem
    user_agent TEXT,                          -- Informações de dispositivo/navegador
    details JSONB DEFAULT '{}'::jsonb,        -- Detalhes do evento (motivo, duração, status anterior/novo)
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Índices para buscas rápidas em Auditoria
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.access_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_machine ON public.access_audit_logs(machine_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.access_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.access_audit_logs(created_at DESC);

-- 5. Trigger: Fair Sharing, Limite de Cotas Semanais e Snapshot Automático
CREATE OR REPLACE FUNCTION check_user_fair_share_quota()
RETURNS TRIGGER AS $$
DECLARE
    current_weekly_hours NUMERIC;
    user_limit INT;
    requested_duration NUMERIC;
BEGIN
    -- Se user_id estiver nulo, prosseguir
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Preencher snapshot do e-mail automaticamente a partir do perfil
    IF NEW.user_email_snapshot IS NULL THEN
        SELECT email INTO NEW.user_email_snapshot FROM public.profiles WHERE id = NEW.user_id;
    END IF;

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

-- 6. Trigger Automático de Auditoria do Ciclo de Vida das Reservas
CREATE OR REPLACE FUNCTION log_reservation_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    acting_user UUID;
    user_email_val TEXT;
BEGIN
    acting_user := auth.uid();
    
    -- Obter e-mail de referência
    SELECT email INTO user_email_val 
    FROM public.profiles 
    WHERE id = COALESCE(NEW.user_id, OLD.user_id);

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.access_audit_logs (user_id, user_email, machine_id, action, details)
        VALUES (
            NEW.user_id, 
            COALESCE(user_email_val, NEW.user_email_snapshot), 
            NEW.machine_id, 
            'reservation_created', 
            jsonb_build_object(
                'reservation_id', NEW.id,
                'purpose', NEW.purpose,
                'workload_type', NEW.workload_type,
                'start_time', NEW.start_time,
                'end_time', NEW.end_time
            )
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.status IS DISTINCT FROM NEW.status) THEN
            INSERT INTO public.access_audit_logs (user_id, user_email, machine_id, action, details)
            VALUES (
                NEW.user_id,
                COALESCE(user_email_val, NEW.user_email_snapshot),
                NEW.machine_id,
                'reservation_status_changed',
                jsonb_build_object(
                    'reservation_id', NEW.id,
                    'old_status', OLD.status,
                    'new_status', NEW.status,
                    'cancelled_by', NEW.cancelled_by,
                    'cancelled_at', NEW.cancelled_at,
                    'changed_by', acting_user
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reservation_audit ON public.reservations;
CREATE TRIGGER trg_reservation_audit
AFTER INSERT OR UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION log_reservation_audit_event();

-- 7. View Agregada para Exportação de Métricas do Laboratório
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

-- 8. Habilitar Realtime para Reservas, Máquinas e Logs de Auditoria
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.machines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.access_audit_logs;

-- 9. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de Profiles (Segurança Reforçada: Sem Auto-Promoção para Admin)
DROP POLICY IF EXISTS "Perfis visíveis para autenticados" ON public.profiles;
CREATE POLICY "Perfis visíveis para autenticados" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuário atualiza seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuário atualiza seu próprio perfil" ON public.profiles FOR UPDATE TO authenticated 
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id AND (
        -- Bloqueia alteração direta de papel via cliente; somente se o papel não for alterado ou se for admin
        role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
);

-- 9.1 Função e Trigger de Proteção e Governança de Perfis (Impede auto-promoção indevida)
CREATE OR REPLACE FUNCTION protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Bloquear alteração de role, cota semanal e status ativo por usuários normais
    IF (TG_OP = 'UPDATE') THEN
        IF (NEW.role IS DISTINCT FROM OLD.role OR 
            NEW.weekly_hours_limit IS DISTINCT FROM OLD.weekly_hours_limit OR
            NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
            
            -- Permite apenas se for service_role (backend autenticado) ou se o executor já for um admin no banco
            IF current_user != 'service_role' AND NOT EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() AND role = 'admin'
            ) THEN
                RAISE EXCEPTION 'Operação Não Permitida: Apenas administradores confirmados ou o sistema podem alterar papéis (roles) ou cotas de acesso.';
            END IF;
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
        -- Ao inserir, usuários comuns nunca podem definir a si mesmos como admin diretamente via cliente
        IF (NEW.role = 'admin' AND current_user != 'service_role') THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() AND role = 'admin'
            ) THEN
                NEW.role := 'student';
                NEW.weekly_hours_limit := 20;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_fields
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION protect_profile_sensitive_fields();

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

-- Políticas de Auditoria (Append-Only / Imutável)
-- Admins têm visibilidade total dos logs
DROP POLICY IF EXISTS "Admins visualizam todos os logs de auditoria" ON public.access_audit_logs;
CREATE POLICY "Admins visualizam todos os logs de auditoria" ON public.access_audit_logs
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Usuários podem visualizar apenas os seus próprios registros de acesso
DROP POLICY IF EXISTS "Usuarios visualizam seus proprios logs de auditoria" ON public.access_audit_logs;
CREATE POLICY "Usuarios visualizam seus proprios logs de auditoria" ON public.access_audit_logs
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Usuários e triggers autenticados podem inserir novos logs de acesso
DROP POLICY IF EXISTS "Insercao de logs permitida para autenticados" ON public.access_audit_logs;
CREATE POLICY "Insercao de logs permitida para autenticados" ON public.access_audit_logs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- NOTA DE SEGURANÇA: Não são criadas políticas de UPDATE ou DELETE para access_audit_logs.
-- Isso garante por RLS que o histórico seja 100% imutável e à prova de adulteração.

-- 10. Seed Inicial de Máquinas do Laboratório
INSERT INTO public.machines (code_name, specs, status, is_exclusive)
VALUES 
    ('GEOCE-NODE-01', '{"gpu": "NVIDIA RTX 3060", "vram_gb": 12, "cpu_cores": 32, "ram_gb": 64, "storage": "2TB NVMe"}', 'available', false),
    ('GEOCE-NODE-02', '{"gpu": "NVIDIA RTX 2060 SUPER", "vram_gb": 8, "cpu_cores": 32, "ram_gb": 64, "storage": "2TB NVMe"}', 'in_use', true)
ON CONFLICT (code_name) DO NOTHING;

-- 11. Concessão de Privilégios (GRANTs) para as Roles do Supabase
-- Corrige o erro 42501 (permission denied for table profiles)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

