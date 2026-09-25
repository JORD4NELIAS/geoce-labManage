'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useUserQuota() {
  const [usedHours, setUsedHours] = useState(0);
  const [limitHours, setLimitHours] = useState(20);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchQuota = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Obter limite semanal do perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('weekly_hours_limit')
        .eq('id', user.id)
        .single();

      if (profile?.weekly_hours_limit) {
        setLimitHours(profile.weekly_hours_limit);
      }

      // 2. Calcular total de horas consumidas nos últimos 7 dias
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: reservations, error } = await supabase
        .from('reservations')
        .select('duration_hours')
        .eq('user_id', user.id)
        .in('status', ['queued', 'approved', 'active', 'completed'])
        .gte('start_time', sevenDaysAgo);

      if (error) throw error;

      const total = (reservations || []).reduce(
        (acc, r) => acc + (Number(r.duration_hours) || 0),
        0
      );

      setUsedHours(total);
    } catch (err) {
      console.error('[useUserQuota] Erro ao obter cota:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  return { usedHours, limitHours, loading, refreshQuota: fetchQuota };
}
