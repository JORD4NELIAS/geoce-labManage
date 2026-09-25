'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShieldAlert, Server, CheckCircle2, RefreshCw, Plus, Edit2, AlertTriangle } from 'lucide-react';
import { MachineStatus } from '@/types/database';

export default function AdminPage() {
  const [machines, setMachines] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();

  const loadData = async () => {
    try {
      setLoading(true);
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
        return;
      }
      setIsAdmin(true);

      const [machinesRes, profilesRes] = await Promise.all([
        supabase.from('machines').select('*').order('code_name', { ascending: true }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      ]);

      setMachines(machinesRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar painel adm:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateMachineStatus = async (machineId: string, newStatus: MachineStatus) => {
    try {
      const { error } = await supabase
        .from('machines')
        .update({ status: newStatus })
        .eq('id', machineId);

      if (error) throw error;
      loadData();
    } catch (err: any) {
      alert(err.message || 'Falha ao atualizar máquina.');
    }
  };

  const updateWeeklyQuota = async (profileId: string, currentLimit: number) => {
    const newLimitStr = prompt('Informe a nova cota semanal em horas para este usuário:', String(currentLimit));
    if (!newLimitStr) return;
    const newLimit = parseInt(newLimitStr, 10);
    if (isNaN(newLimit) || newLimit <= 0) {
      alert('Valor inválido.');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ weekly_hours_limit: newLimit })
        .eq('id', profileId);

      if (error) throw error;
      loadData();
    } catch (err: any) {
      alert(err.message || 'Falha ao atualizar cota.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-400 gap-2">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Carregando painel de administração...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-8 text-center max-w-lg mx-auto">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-white">Acesso Restrito</h2>
        <p className="text-xs text-slate-400 mt-1">
          Apenas administradores do GEOCE possuem permissão para gerenciar nós e cotas de usuários.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Gestão do Laboratório & Hardware
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Controle de status de nós, permissões e ajustes de cotas Fair Sharing.
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl transition-all border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar
        </button>
      </div>

      {/* Machines Status Control */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          Gerenciamento de Nós
        </h2>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Código / Nome</th>
                <th className="py-3 px-4">GPU / Specs</th>
                <th className="py-3 px-4">Status Atual</th>
                <th className="py-3 px-4 text-right">Alterar Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {machines.map((m) => (
                <tr key={m.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-bold text-slate-200">{m.code_name}</td>
                  <td className="py-3 px-4 text-slate-400">
                    {m.specs.gpu} | {m.specs.vram_gb}GB VRAM
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono uppercase text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5">
                    <button
                      onClick={() => updateMachineStatus(m.id, 'available')}
                      className="px-2 py-1 rounded text-[11px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    >
                      Liberar
                    </button>
                    <button
                      onClick={() => updateMachineStatus(m.id, 'maintenance')}
                      className="px-2 py-1 rounded text-[11px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    >
                      Manutenção
                    </button>
                    <button
                      onClick={() => updateMachineStatus(m.id, 'offline')}
                      className="px-2 py-1 rounded text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-300"
                    >
                      Offline
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users & Quota Adjustments */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Usuários & Ajuste de Cotas Fair Sharing
        </h2>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Papel</th>
                <th className="py-3 px-4">Cota Semanal</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-semibold text-slate-200">{p.full_name}</td>
                  <td className="py-3 px-4 text-slate-400">{p.email}</td>
                  <td className="py-3 px-4 capitalize font-mono text-[11px]">{p.role}</td>
                  <td className="py-3 px-4 font-bold text-emerald-400">{p.weekly_hours_limit || 20}h</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => updateWeeklyQuota(p.id, p.weekly_hours_limit || 20)}
                      className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                      Editar Cota
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
