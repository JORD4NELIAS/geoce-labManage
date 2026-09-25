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
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Validar se o solicitante é Administrador
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Acesso restrito a administradores do laboratório' },
      { status: 403 }
    );
  }

  // Obter visão de métricas agregadas
  const { data: metrics, error } = await supabase
    .from('vw_lab_metrics')
    .select('*');

  if (error || !metrics) {
    return NextResponse.json(
      { error: 'Erro ao gerar métricas do laboratório' },
      { status: 500 }
    );
  }

  if (format === 'csv') {
    const headers = [
      'Máquina',
      'GPU',
      'Total Reservas',
      'Horas Alocadas',
      'Média Horas/Sessão',
      'Cancelamentos',
      'Concluídas',
    ];
    const rows = metrics.map((m: any) => [
      `"${m.machine_name}"`,
      `"${m.gpu_model || 'N/A'}"`,
      m.total_reservations,
      m.total_hours_allocated,
      m.avg_session_duration_hours,
      m.total_cancellations,
      m.total_completed,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join(
      '\n'
    );

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="geoce_lab_metrics_${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({ data: metrics });
}
