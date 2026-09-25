'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart3, Download, FileText, CheckCircle, XCircle, Clock, ShieldAlert } from 'lucide-react';

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function loadMetrics() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role !== 'admin') {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setIsAdmin(true);

        const { data, error } = await supabase
          .from('vw_lab_metrics')
          .select('*');

        if (error) throw error;
        setMetrics(data || []);
      } catch (err) {
        console.error('Erro ao obter métricas:', err);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, [supabase]);

  const handleDownloadCSV = () => {
    window.open('/api/metrics/export?format=csv', '_blank');
  };

  const handleDownloadJSON = () => {
    window.open('/api/metrics/export?format=json', '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-400 gap-2">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Consolidando métricas laboratoriais...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-8 text-center max-w-lg mx-auto">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-white">Acesso Restrito</h2>
        <p className="text-xs text-slate-400 mt-1">
          A exportação e auditoria de métricas é restrita a administradores do GEOCE.
        </p>
      </div>
    );
  }

  const totalAllHours = metrics.reduce((acc, m) => acc + (Number(m.total_hours_allocated) || 0), 0);
  const totalAllReservations = metrics.reduce((acc, m) => acc + (Number(m.total_reservations) || 0), 0);
  const totalAllCompleted = metrics.reduce((acc, m) => acc + (Number(m.total_completed) || 0), 0);
  const totalAllCancelled = metrics.reduce((acc, m) => acc + (Number(m.total_cancellations) || 0), 0);

  return (
    <div className="space-y-8">
      {/* Header & Export Triggers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Métricas de Uso e Alocação de Hardware
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Auditoria consolidada da utilização de GPUs, taxas de conclusão e cancelamento.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDownloadCSV}
            className="inline-flex items-center gap-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/10"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            onClick={handleDownloadJSON}
            className="inline-flex items-center gap-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2.5 rounded-xl transition-all border border-slate-700"
          >
            <FileText className="w-4 h-4" />
            Exportar JSON
          </button>
        </div>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <p className="text-[11px] font-medium text-slate-400">Total de Horas Alocadas</p>
          <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">
            {totalAllHours.toFixed(1)}h
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <p className="text-[11px] font-medium text-slate-400">Total de Reservas Criadas</p>
          <p className="text-2xl font-bold text-white font-mono mt-1">
            {totalAllReservations}
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <p className="text-[11px] font-medium text-slate-400">Sessões Concluídas</p>
          <p className="text-2xl font-bold text-sky-400 font-mono mt-1">
            {totalAllCompleted}
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <p className="text-[11px] font-medium text-slate-400">Cancelamentos Registrados</p>
          <p className="text-2xl font-bold text-rose-400 font-mono mt-1">
            {totalAllCancelled}
          </p>
        </div>
      </div>

      {/* Metrics Table */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-white">Desempenho por Máquina / Nó</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Máquina</th>
                <th className="py-3 px-4">GPU / Acelerador</th>
                <th className="py-3 px-4 text-center">Total Reservas</th>
                <th className="py-3 px-4 text-center">Horas Alocadas</th>
                <th className="py-3 px-4 text-center">Média Duração</th>
                <th className="py-3 px-4 text-center">Concluídas</th>
                <th className="py-3 px-4 text-center">Canceladas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {metrics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Ainda não há dados suficientes para compor o histórico de métricas.
                  </td>
                </tr>
              ) : (
                metrics.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="py-3.5 px-4 font-bold text-slate-200">{m.machine_name}</td>
                    <td className="py-3.5 px-4 text-slate-400">{m.gpu_model || 'Geral'}</td>
                    <td className="py-3.5 px-4 text-center font-mono">{m.total_reservations}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400">
                      {m.total_hours_allocated}h
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                      {m.avg_session_duration_hours}h
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <CheckCircle className="w-3 h-3" /> {m.total_completed}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-rose-400">
                        <XCircle className="w-3 h-3" /> {m.total_cancellations}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
