'use client';

import React, { useState } from 'react';
import { useRealtimeQueue } from '@/hooks/useRealtimeQueue';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  User,
  Server,
  Terminal,
  Copy,
  Check,
  X
} from 'lucide-react';
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
  const [selectedMachineForAccess, setSelectedMachineForAccess] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className="space-y-4">
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
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {reservations.map((r, index) => {
              const isOwner = currentUserId === r.user_id;
              const canCancel = isOwner || isAdmin;
              const isReadyForAccess = r.status === 'active' || r.status === 'approved';

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

                  <td className="py-3.5 px-4 max-w-[180px] truncate" title={r.purpose}>
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

                  <td className="py-3.5 px-4 text-right space-x-1.5">
                    {isReadyForAccess && (isOwner || isAdmin) && (
                      <button
                        onClick={() => setSelectedMachineForAccess(r.machines)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded transition-colors border border-emerald-500/30"
                      >
                        <Terminal className="w-3 h-3" />
                        Conectar
                      </button>
                    )}

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

      {/* Modal de Instruções de Conexão e Acesso */}
      {selectedMachineForAccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Instruções de Acesso: {selectedMachineForAccess.code_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMachineForAccess(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">
                  Comando SSH para Conexão
                </span>
                <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg font-mono text-emerald-400 text-xs border border-slate-800">
                  <span className="truncate">
                    ssh aluno@{selectedMachineForAccess.specs?.ip_address || '192.168.1.X'} -p {selectedMachineForAccess.specs?.ssh_port || 22}
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `ssh aluno@${selectedMachineForAccess.specs?.ip_address || '192.168.1.X'} -p ${selectedMachineForAccess.specs?.ssh_port || 22}`
                      )
                    }
                    className="p-1 text-slate-400 hover:text-slate-200"
                    title="Copiar comando"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5">
                <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">
                  Orientações do Administrador
                </span>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedMachineForAccess.specs?.access_instructions ||
                    'Acesse a máquina conectado à rede física do Laboratório GEOCE ou via VPN da UFC. Utilize sua chave SSH ou credenciais de aluno autorizadas.'}
                </p>
              </div>

              <div className="text-[11px] text-slate-500 pt-1">
                Lembre-se: Após concluir seus experimentos, finalize seus processos e scripts para liberar recursos ao próximo usuário da fila.
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-right">
              <button
                onClick={() => setSelectedMachineForAccess(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
