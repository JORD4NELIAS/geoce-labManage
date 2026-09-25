import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // 1. Validar no banco se quem está chamando É REALMENTE um ADMIN
    const { data: callerProfile, error: callerError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerError || callerProfile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso Negado: Apenas administradores confirmados podem alterar cotas de usuários.' },
        { status: 403 }
      );
    }

    // 2. Extrair parâmetros
    const body = await request.json();
    const { targetUserId, weeklyHoursLimit } = body;

    const limit = Number(weeklyHoursLimit);
    if (!targetUserId || isNaN(limit) || limit <= 0 || limit > 168) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos. O limite semanal deve ser entre 1 e 168 horas.' },
        { status: 400 }
      );
    }

    // 3. Atualizar cota do usuário alvo com service_role
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ weekly_hours_limit: limit })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('[API Users Quota] Erro ao atualizar cota:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Cota semanal atualizada para ${limit}h com sucesso.`,
    });
  } catch (err: any) {
    console.error('[API Users Quota] Erro interno:', err);
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 });
  }
}
