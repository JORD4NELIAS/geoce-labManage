'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserQuota } from '@/hooks/useUserQuota';
import { WorkloadCategory } from '@/types/database';
import { Calendar, Clock, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';

export default function ReservePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedMachineId = searchParams.get('machine_id') || '';

  const { usedHours, limitHours, refreshQuota } = useUserQuota();
  const [machines, setMachines] = useState<any[]>([]);
  const [selectedMachine, setSelectedMachine] = useState(preselectedMachineId);
  const [workloadType, setWorkloadType] = useState<WorkloadCategory>('deep_learning');
  const [purpose, setPurpose] = useState('');
  
  // Format default start time (now + 5 mins) and end time (now + 2h 5 mins)
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date(Date.now() + (2 * 60 + 5) * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function fetchMachines() {
      const { data } = await supabase.from('machines').select('*');
      setMachines(data || []);
      if (!selectedMachine && data && data.length > 0) {
        setSelectedMachine(data[0].id);
      }
    }
    fetchMachines();
  }, [supabase, selectedMachine]);

  // Duration calculations
  const calculateDurationHours = () => {
    if (!startTime || !endTime) return 0;
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const diff = (end - start) / (1000 * 60 * 60);
    return Math.max(0, diff);
  };

  const requestedDuration = calculateDurationHours();
  const remainingQuota = Math.max(0, limitHours - usedHours);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedMachine) {
      setErrorMsg('Por favor, selecione uma máquina.');
      return;
    }

    if (requestedDuration <= 0) {
      setErrorMsg('O horário de término deve ser posterior ao horário de início.');
      return;
    }

    if (requestedDuration > 4.0) {
      setErrorMsg('Regra de Fair Sharing: Cada sessão tem duração máxima de 4 horas.');
      return;
    }

    if (requestedDuration > remainingQuota) {
      setErrorMsg(
        `Limite de cota excedido: Você solicitou ${requestedDuration.toFixed(1)}h, mas restam apenas ${remainingQuota.toFixed(1)}h nesta semana.`
      );
      return;
    }

    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { error } = await supabase.from('reservations').insert({
        user_id: user.id,
        machine_id: selectedMachine,
        purpose,
        workload_type: workloadType,
        status: 'queued',
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
      });

      if (error) {
        throw error;
      }

      refreshQuota();
      router.push('/queue');
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao processar reserva no banco.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Agendamento de Hardware & Cota
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Informe os detalhes do processamento para alocação na máquina e validação de Fair Sharing.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5"
      >
        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Machine selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Máquina / Estação de Trabalho
          </label>
          <select
            value={selectedMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            required
          >
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code_name} — {m.specs.gpu || 'GPU'} ({m.status})
              </option>
            ))}
          </select>
        </div>

        {/* Workload category */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Tipo de Carga de Trabalho
          </label>
          <select
            value={workloadType}
            onChange={(e) => setWorkloadType(e.target.value as WorkloadCategory)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="deep_learning">Deep Learning / Treinamento de Modelos</option>
            <option value="data_science">Ciência de Dados / Big Data</option>
            <option value="cad_3d">Renderização 3D / CAD</option>
            <option value="general_compilation">Compilação Geral de Software</option>
            <option value="testing">Testes e Benchmarks</option>
          </select>
        </div>

        {/* Start and End Times */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Horário de Início
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Horário de Término
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
        </div>

        {/* Duration & Fair Sharing Indicator */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400">Duração Solicitada: </span>
            <strong className={`font-mono text-sm ${requestedDuration > 4.0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {requestedDuration.toFixed(2)}h
            </strong>
          </div>
          <div className="text-right">
            <span className="text-slate-400">Sua Cota Disponível: </span>
            <strong className="text-slate-200 font-mono text-sm">{remainingQuota.toFixed(2)}h</strong>
          </div>
        </div>

        {/* Purpose */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Finalidade / Descrição do Experimento
          </label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={3}
            placeholder="Ex: Treinamento de modelo YOLOv8 para detecção de feições geológicas com 100 épocas."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || requestedDuration <= 0 || requestedDuration > 4.0}
          className="w-full py-3.5 rounded-xl font-semibold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          <span>Confirmar e Enviar para Fila FIFO</span>
        </button>
      </form>
    </div>
  );
}
