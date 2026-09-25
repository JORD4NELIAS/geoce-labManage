'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import MachineCard from '@/components/MachineCard';
import { Server, CheckCircle2, Flame, Wrench, RefreshCw } from 'lucide-react';

export default function CatalogPage() {
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadMachines = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('code_name', { ascending: true });

      if (error) throw error;
      setMachines(data || []);
    } catch (err) {
      console.error('Erro ao carregar máquinas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMachines();

    // Supabase Realtime channel para máquinas
    const channel = supabase
      .channel('realtime_machines')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'machines' },
        () => {
          loadMachines();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const availableCount = machines.filter((m) => m.status === 'available').length;
  const inUseCount = machines.filter((m) => m.status === 'in_use').length;
  const maintenanceCount = machines.filter((m) => m.status === 'maintenance').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Catálogo de Hardware & GPUs
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Selecione uma máquina para alocação direta ou entre na fila FIFO prioritária.
          </p>
        </div>
        <button
          onClick={loadMachines}
          className="self-start inline-flex items-center gap-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl transition-all border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar Inventário
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-slate-800 text-slate-300">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">Total de Nós</p>
            <p className="text-xl font-bold text-white">{machines.length}</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">Disponíveis Agora</p>
            <p className="text-xl font-bold text-emerald-400">{availableCount}</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">Em Processamento</p>
            <p className="text-xl font-bold text-amber-400">{inUseCount}</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">Em Manutenção</p>
            <p className="text-xl font-bold text-rose-400">{maintenanceCount}</p>
          </div>
        </div>
      </div>

      {/* Machine Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-400 gap-2">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Carregando catálogo de hardware...</span>
        </div>
      ) : machines.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 p-12 text-center rounded-2xl">
          <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-base font-semibold text-slate-300">Nenhuma máquina cadastrada</p>
          <p className="text-xs text-slate-500 mt-1">
            Execute o script `schema.sql` no Supabase para carregar o seed inicial de hardware.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machines.map((machine) => (
            <MachineCard key={machine.id} machine={machine} />
          ))}
        </div>
      )}
    </div>
  );
}
