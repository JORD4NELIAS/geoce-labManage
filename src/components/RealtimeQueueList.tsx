'use client';

import React, { useState } from 'react';
import { useRealtimeQueue } from '@/hooks/useRealtimeQueue';
import { Clock, CheckCircle2, AlertCircle, XCircle, User, Server } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RealtimeQueueListProps {
  currentUserId?: string;
  isAdmin?: boolean;
}

export default function RealtimeQueueList({
  currentUserId,
  isAdmin = false,
}: RealtimeQueueListProps) {
  const { reservations, loading, refreshQueue } = useRealtimeQueue();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (reservationId: string) => {
    if (!confirm('Deseja realmente cancelar este agendamento na fila?')) return;

    try {
      setCancellingId(reservationId);
      const res = await fetch('/api/reservations/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: reservationId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || 'Erro ao cancelar reserva.');
      } else {
        refreshQueue();
      }
    } catch (err) {
      console.error(err);
      alert('Falha na comunicação ao cancelar.');
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Em Execução
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <Clock className="w-3 h-3" /> Aprovado
          </span>
        );
      case 'queued':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" /> Na Fila FIFO
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 gap-2">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Carregando fila em tempo real...</span>
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-10 text-center">
        <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h4 className="text-base font-semibold text-slate-200">Fila Vazia</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Não há requisições aguardando no momento. As máquinas disponíveis podem ser reservadas imediatamente.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl">
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
          <tr>
            <th className="py-3 px-4">Posição / Solicitado</th>
            <th className="py-3 px-4">Máquina</th>
            <th className="py-3 px-4">Pesquisador</th>
            <th className="py-3 px-4">Finalidade</th>
            <th className="py-3 px-4">Período</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80">
          {reservations.map((r, index) => {
            const isOwner = currentUserId === r.user_id;
            const canCancel = isOwner || isAdmin;

            return (
              <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 px-4 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-[10px]">
                      #{index + 1}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {r.requested_at ? format(new Date(r.requested_at), 'dd/MM HH:mm', { locale: ptBR }) : '-'}
                    </span>
                  </div>
                </td>

                <td className="py-3.5 px-4 font-semibold text-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-sky-400" />
                    <span>{r.machines?.code_name || 'Máquina'}</span>
                  </div>
                </td>

                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{r.profiles?.full_name || 'Pesquisador'}</span>
                  </div>
                </td>

                <td className="py-3.5 px-4 max-w-[200px] truncate" title={r.purpose}>
                  {r.purpose}
                </td>

                <td className="py-3.5 px-4 text-slate-400 font-mono">
                  {r.start_time && r.end_time ? (
                    <span>
                      {format(new Date(r.start_time), 'dd/MM HH:mm')} - {format(new Date(r.end_time), 'HH:mm')} ({r.duration_hours || '0'}h)
                    </span>
                  ) : (
                    'Sob demanda'
                  )}
                </td>

                <td className="py-3.5 px-4">
                  {getStatusBadge(r.status)}
                </td>

                <td className="py-3.5 px-4 text-right">
                  {canCancel && (
                    <button
                      onClick={() => handleCancel(r.id)}
                      disabled={cancellingId === r.id}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3 h-3" />
                      {cancellingId === r.id ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
