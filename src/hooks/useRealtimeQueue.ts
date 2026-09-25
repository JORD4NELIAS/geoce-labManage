'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database';

type Reservation = Database['public']['Tables']['reservations']['Row'] & {
  profiles?: { full_name: string; email: string };
  machines?: { code_name: string; specs: any };
};

export function useRealtimeQueue() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchQueue = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, profiles:user_id(full_name, email), machines:machine_id(code_name, specs)')
        .in('status', ['queued', 'approved', 'active'])
        .order('requested_at', { ascending: true });

      if (error) throw error;
      setReservations((data as any) || []);
    } catch (err) {
      console.error('[useRealtimeQueue] Erro ao carregar fila:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchQueue();

    // Inscrição no canal Realtime do Supabase
    const channel = supabase
      .channel('realtime_reservations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchQueue]);

  return { reservations, loading, refreshQueue: fetchQueue };
}
