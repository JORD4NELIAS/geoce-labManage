import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { reservation_id } = await request.json();

    if (!reservation_id) {
      return NextResponse.json(
        { error: 'ID da reserva não informado.' },
        { status: 400 }
      );
    }

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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Obter perfil do usuário para checar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    // Obter dados da reserva para validar titularidade
    const { data: reservation, error: fetchErr } = await supabase
      .from('reservations')
      .select('user_id, status')
      .eq('id', reservation_id)
      .single();

    if (fetchErr || !reservation) {
      return NextResponse.json(
        { error: 'Reserva não encontrada.' },
        { status: 404 }
      );
    }

    if (!isAdmin && reservation.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Você não tem permissão para cancelar este agendamento.' },
        { status: 403 }
      );
    }

    // Executar cancelamento seguro
    const { error: updateErr } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', reservation_id);

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message || 'Erro ao cancelar reserva.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Reserva cancelada com sucesso.' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro interno no servidor.' },
      { status: 500 }
    );
  }
}
