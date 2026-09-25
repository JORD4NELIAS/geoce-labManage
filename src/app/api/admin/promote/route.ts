import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPreAuthorizedAdminEmail } from '@/lib/auth/admins';

export async function POST() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    }

    // REGRA DE SEGURANÇA ESTRITA:
    // Apenas contas que estejam na lista de administradores autorizados (ADMIN_EMAILS / ADMIN_ALERT_EMAIL)
    // podem ter permissão de auto-ativação.
    if (!isPreAuthorizedAdminEmail(user.email)) {
      return NextResponse.json(
        {
          error:
            'Acesso Negado: Seu e-mail não consta na lista de administradores autorizados do GEOCE. O papel de Administrador só pode ser concedido diretamente no banco SQL ou por um gestor já autenticado.',
        },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();

    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      'Administrador GEOCE';

    const { data, error } = await adminClient
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        role: 'admin',
        weekly_hours_limit: 100,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[API Promote] Erro ao sincronizar perfil:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `A conta pré-autorizada ${user.email} foi ativada como Administradora!`,
      profile: data,
    });
  } catch (err: any) {
    console.error('[API Promote] Erro interno:', err);
    return NextResponse.json({ error: err.message || 'Falha interna ao verificar autorização.' }, { status: 500 });
  }
}
