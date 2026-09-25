# GEOCE LabLicence — Antigravity Orchestration & Architecture Blueprint

Este documento consolida a arquitetura completa, o modelo relacional com cotas/Fair Sharing, a árvore modular de serviços e o manifesto de compilação para o **Antigravity** (motor de orquestração e scaffolding de projetos).

---

## 1. Manifesto de Compilação: `antigravity.yaml`

Salve este arquivo na raiz do repositório como `antigravity.yaml` para permitir que o Antigravity compile e provisione a infraestrutura do projeto:

```yaml
version: "1.0"
project:
  name: "GEOCE LabLicence"
  slug: "geoce-lablicence"
  version: "0.1.0"
  description: "Sistema inteligente de alocação de hardware, filas FIFO, cotas justas e métricas laboratoriais."
  author: "GEOCE Lab Engineering Team"

runtime:
  framework: "nextjs"
  framework_version: "14.x"
  node_version: "20.x"
  package_manager: "pnpm"
  language: "typescript"

infrastructure:
  hosting:
    provider: "vercel"
    region: "gru1" # São Paulo (baixa latência)
    env_sync: true
  database:
    provider: "supabase"
    type: "postgresql"
    features:
      - "realtime"
      - "row_level_security"
      - "pg_cron"
      - "pg_stat_statements"
  auth:
    provider: "supabase_auth"
    strategies:
      - "google_oauth"
  notifications:
    provider: "resend"

policies:
  fair_sharing:
    enabled: true
    max_session_duration_hours: 4
    weekly_quota_hours_per_user: 20
    inactivity_timeout_minutes: 15
  fifo_queue:
    enabled: true
    priority_field: "requested_at"
    cancellation_rules:
      - "owner_only"
      - "admin_override"
  metrics_export:
    enabled: true
    formats: ["csv", "json"]
    retention_days: 365

scripts:
  bootstrap: "pnpm install && pnpm db:migrate"
  dev: "next dev"
  build: "next build"
  start: "next start"
  lint: "next lint"
```

---

## 2. Esquema de Banco de Dados com Fair Sharing e Métricas (Supabase / PostgreSQL)

Este script implementa:
1. Perfis e Máquinas.
2. Fila FIFO e Reservas.
3. **Mecanismo de Cotas / Fair Sharing** (validação de horas semanais).
4. **Tabela e Views de Métricas de Uso** prontas para exportação em CSV/JSON.

```sql
-- Habilitação de extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums do Sistema
CREATE TYPE user_role AS ENUM ('admin', 'researcher', 'student');
CREATE TYPE machine_status AS ENUM ('available', 'in_use', 'maintenance', 'offline');
CREATE TYPE reservation_status AS ENUM ('queued', 'approved', 'active', 'completed', 'cancelled', 'expired');
CREATE TYPE workload_category AS ENUM ('deep_learning', 'data_science', 'cad_3d', 'general_compilation', 'testing');

-- 1. Perfis de Usuários
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role user_role DEFAULT 'student',
    weekly_hours_limit INT DEFAULT 20, -- Cota Fair Sharing configurável por usuário
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Máquinas e Perfis de Hardware
CREATE TABLE public.machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_name TEXT NOT NULL UNIQUE,       -- Ex: "GEOCE-GPU-01", "LAB-WORKSTATION-04"
    specs JSONB NOT NULL,                 -- Ex: {"gpu": "RTX 4090", "vram_gb": 24, "cpu_cores": 32, "ram_gb": 64}
    status machine_status DEFAULT 'available',
    is_exclusive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Reservas, Fila FIFO e Alocação
CREATE TABLE public.reservations (
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
CREATE INDEX idx_reservations_fifo ON public.reservations(machine_id, status, requested_at ASC);
CREATE INDEX idx_reservations_user ON public.reservations(user_id);
CREATE INDEX idx_reservations_period ON public.reservations(start_time, end_time);

-- 4. Função de Validação: Fair Sharing & Limite de Cotas Semanais
CREATE OR REPLACE FUNCTION check_user_fair_share_quota()
RETURNS TRIGGER AS $$
DECLARE
    current_weekly_hours NUMERIC;
    user_limit INT;
    requested_duration NUMERIC;
BEGIN
    -- Obter cota semanal configurada do usuário
    SELECT weekly_hours_limit INTO user_limit FROM public.profiles WHERE id = NEW.user_id;

    -- Calcular duração solicitada em horas
    requested_duration := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600;

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

CREATE TRIGGER trg_validate_quota
BEFORE INSERT ON public.reservations
FOR EACH ROW
WHEN (NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL)
EXECUTE FUNCTION check_user_fair_share_quota();

-- 5. View Agregada para Exportação de Métricas
CREATE OR REPLACE VIEW public.vw_lab_metrics AS
SELECT 
    m.code_name AS machine_name,
    m.specs->>'gpu' AS gpu_model,
    COUNT(r.id) AS total_reservations,
    ROUND(COALESCE(SUM(r.duration_hours), 0), 2) AS total_hours_allocated,
    ROUND(AVG(r.duration_hours), 2) AS avg_session_duration_hours,
    COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END) AS total_cancellations,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS total_completed
FROM public.machines m
LEFT JOIN public.reservations r ON m.id = r.machine_id
GROUP BY m.id, m.code_name, m.specs;

-- 6. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfis visíveis para autenticados" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Máquinas visíveis para autenticados" ON public.machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Fila visível publicamente a usuários autenticados" ON public.reservations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuário cria sua própria reserva" ON public.reservations FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Cancelamento por Dono ou Admin" ON public.reservations FOR UPDATE TO authenticated
USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (status = 'cancelled');
```

---

## 3. Estrutura Modular Completa de Diretórios

A distribuição abaixo segue os padrões do Next.js App Router, integrando Tailwind CSS, rotas de API para exportação de dados e conexão direta com Supabase.

```
geoce-lablicence/
├── antigravity.yaml                 # Manifesto de orquestração do projeto
├── vercel.json                      # Configuração de headers e rewrites da Vercel
├── .env.example                     # Variáveis de ambiente declaradas
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx         # Login social Google OAuth
│   │   │   └── callback/
│   │   │       └── route.ts         # Troca de token e disparos transacionais
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx           # Shell da aplicação (Sidebar + Header)
│   │   │   ├── page.tsx             # Catálogo de máquinas e inventário
│   │   │   ├── queue/
│   │   │   │   └── page.tsx         # Fila FIFO com status ao vivo via WebSocket
│   │   │   ├── reserve/
│   │   │   │   └── page.tsx         # Formulário com propósito e validação de cota
│   │   │   └── admin/
│   │   │       ├── page.tsx         # Painel de gestão e auditoria do ADM
│   │   │       └── metrics/
│   │   │           └── page.tsx     # Dashboard analítico e exportação CSV/JSON
│   │   └── api/
│   │       ├── metrics/
│   │       │   └── export/
│   │       │       └── route.ts     # Endpoint de exportação de métricas (CSV/JSON)
│   │       └── reservations/
│   │           └── cancel/
│   │               └── route.ts     # Cancelamento atômico seguro
│   ├── components/
│   │   ├── ui/                      # Design system (Buttons, Modals, Badges)
│   │   ├── MachineCard.tsx          # Card visual da máquina e status
│   │   ├── RealtimeQueueList.tsx    # Lista FIFO reativa via Supabase Realtime
│   │   └── QuotaTracker.tsx         # Barra de progresso da cota semanal do aluno
│   ├── hooks/
│   │   ├── useRealtimeQueue.ts      # WebSocket listener da tabela 'reservations'
│   │   └── useUserQuota.ts          # Cálculo e monitor de horas consumidas
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts            # Cliente Client-Side
│   │   │   └── server.ts            # Cliente Server-Side com gestão de cookies
│   │   └── email/
│   │       └── resend.ts            # Serviço de disparo de notificações transacionais
│   └── types/
│       └── database.ts              # Tipagens autogeradas do Supabase
```

---

## 4. Pipeline de Notificações Duplas e Cadastro Google

Arquivo: `src/app/(auth)/callback/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const cookieStore = cookies();

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) { cookieStore.set({ name, value, ...options }); },
          remove(name: string, options: any) { cookieStore.delete({ name, ...options }); },
        },
      }
    );

    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session?.user) {
      const user = session.user;
      
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      // Primeiro acesso: sincronizar perfil e disparar e-mails para Usuário e ADM
      if (!existingProfile) {
        const fullName = user.user_metadata.full_name || 'Pesquisador/Aluno GEOCE';

        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          full_name: fullName,
          avatar_url: user.user_metadata.avatar_url,
          role: 'student',
          weekly_hours_limit: 20
        });

        // 1. Notificação transacional para o Usuário cadastrado
        await resend.emails.send({
          from: 'GEOCE LabLicence <suporte@geoce.ufc.br>',
          to: user.email!,
          subject: 'Acesso Liberado — GEOCE LabLicence',
          html: `
            <h3>Bem-vindo ao GEOCE LabLicence, ${fullName}!</h3>
            <p>Sua conta Google foi vinculada com sucesso. Você possui uma cota inicial de <strong>20 horas semanais</strong> para agendamento de máquinas e processamento.</p>
          `
        });

        // 2. Notificação de Auditoria para o Administrador do Laboratório
        await resend.emails.send({
          from: 'GEOCE LabLicence <sistema@geoce.ufc.br>',
          to: process.env.ADMIN_ALERT_EMAIL!,
          subject: '[NOVO USUÁRIO] Cadastro via Google Detectado',
          html: `
            <h3>Novo Cadastro Registrado</h3>
            <p><strong>Nome:</strong> ${fullName}</p>
            <p><strong>E-mail:</strong> ${user.email}</p>
            <p><strong>Data/Hora:</strong> ${new Date().toISOString()}</p>
          `
        });
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_exchange_failed`);
}
```

---

## 5. Serviço de Exportação de Métricas (CSV / JSON)

Arquivo: `src/app/api/metrics/export/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
      },
    }
  );

  // Validar se o solicitante é Administrador
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
  }

  // Obter visão de métricas agregadas
  const { data: metrics, error } = await supabase
    .from('vw_lab_metrics')
    .select('*');

  if (error || !metrics) {
    return NextResponse.json({ error: 'Erro ao gerar métricas' }, { status: 500 });
  }

  if (format === 'csv') {
    const headers = ['Máquina', 'GPU', 'Total Reservas', 'Horas Alocadas', 'Média Horas/Sessão', 'Cancelamentos', 'Concluídas'];
    const rows = metrics.map((m: any) => [
      m.machine_name,
      m.gpu_model || 'N/A',
      m.total_reservations,
      m.total_hours_allocated,
      m.avg_session_duration_hours,
      m.total_cancellations,
      m.total_completed,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="geoce_lab_metrics_${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({ data: metrics });
}
```

---

## 6. Configuração de Deploy para Vercel (`vercel.json` e `.env.example`)

### `vercel.json`
```json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "regions": ["gru1"]
}
```

### `.env.example`
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Resend Mail Configuration
RESEND_API_KEY="re_your_resend_api_key"

# Admin Governance Configuration (Whitelist de Provedor)
ADMIN_EMAILS="adm.geoce@ufc.br,coordenador@ufc.br"
ADMIN_ALERT_EMAIL="adm.geoce@ufc.br"

# Application Settings
NEXT_PUBLIC_APP_NAME="GEOCE LabLicence"
NEXT_PUBLIC_APP_URL="https://geoce-lablicence.vercel.app"
```