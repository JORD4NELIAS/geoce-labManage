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
        { error: 'Acesso Negado: Apenas administradores confirmados podem alterar papéis de usuários.' },
        { status: 403 }
      );
    }

    // 2. Extrair parâmetros
    const body = await request.json();
    const { targetUserId, newRole } = body;

    if (!targetUserId || !['admin', 'researcher', 'student'].includes(newRole)) {
      return NextResponse.json({ error: 'Papel ou usuário inválido.' }, { status: 400 });
    }

    // 3. Atualizar papel do usuário alvo
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('[API Users Role] Erro ao atualizar papel:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Papel do usuário atualizado para "${newRole}" com sucesso.`,
    });
  } catch (err: any) {
    console.error('[API Users Role] Erro interno:', err);
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 });
  }
}
