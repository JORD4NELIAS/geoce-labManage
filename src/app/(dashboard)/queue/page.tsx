'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import RealtimeQueueList from '@/components/RealtimeQueueList';
import { Clock, Info } from 'lucide-react';

export default function QueuePage() {
  const [currentUser, setCurrentUser] = useState<{ id: string; isAdmin: boolean } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        setCurrentUser({
          id: user.id,
          isAdmin: profile?.role === 'admin',
        });
      }
    }

    getUser();
  }, [supabase]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Fila FIFO ao Vivo (First-In, First-Out)
          </h1>
        </div>
        <p className="text-xs text-slate-400">
          A alocação de computação segue ordem cronológica estrita de solicitação.
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-start gap-3 text-xs text-slate-300">
        <Info className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-slate-200">Como funciona a fila?</p>
          <p className="text-slate-400 mt-0.5">
            Quando um nó de hardware fica ocupado, novos pedidos são enfileirados automaticamente. Assim que o job corrente finaliza ou é cancelado, a próxima requisição na fila assume a máquina imediatamente.
          </p>
        </div>
      </div>

      {/* Realtime Queue Component */}
      <RealtimeQueueList
        currentUserId={currentUser?.id}
        isAdmin={currentUser?.isAdmin}
      />
    </div>
  );
}
