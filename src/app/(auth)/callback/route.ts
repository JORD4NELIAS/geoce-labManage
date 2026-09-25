import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendWelcomeEmail, sendAdminNewUserAlert } from '@/lib/email/resend';
import { isPreAuthorizedAdminEmail } from '@/lib/auth/admins';
import { createAdminClient } from '@/lib/supabase/admin';

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
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    const {
      data: { session },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session?.user) {
      const user = session.user;
      const adminClient = createAdminClient();

      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single();

      // Regra de Provider / Whitelist:
      // Apenas emails expressamente listados em ADMIN_EMAILS ou ADMIN_ALERT_EMAIL recebem admin automaticamente
      const isAuthorizedAdmin = isPreAuthorizedAdminEmail(user.email);

      // Primeiro acesso: sincronizar perfil e disparar e-mails para Usuário e ADM
      if (!existingProfile) {
        const fullName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          'Pesquisador/Aluno GEOCE';

        await adminClient.from('profiles').insert({
          id: user.id,
          email: user.email!,
          full_name: fullName,
          avatar_url: user.user_metadata?.avatar_url || null,
          role: isAuthorizedAdmin ? 'admin' : 'student',
          weekly_hours_limit: isAuthorizedAdmin ? 100 : 20,
        });

        // Disparo duplo de notificações assíncronas via Resend
        await Promise.allSettled([
          sendWelcomeEmail(user.email!, fullName),
          sendAdminNewUserAlert(fullName, user.email!),
        ]);
      } else if (isAuthorizedAdmin && existingProfile.role !== 'admin') {
        // Auto-promove apenas se o e-mail estiver na lista de admins pré-autorizados
        await adminClient
          .from('profiles')
          .update({ role: 'admin', weekly_hours_limit: 100 })
          .eq('id', user.id);
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_exchange_failed`);
}
