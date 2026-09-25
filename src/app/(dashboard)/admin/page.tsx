'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  ShieldAlert,
  Server,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  X,
  Zap,
  ShieldCheck,
  UserCheck,
  UserCog,
  Lock,
} from 'lucide-react';
import { MachineStatus, UserRole } from '@/types/database';

export default function AdminPage() {
  const [machines, setMachines] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Modal de Nova Máquina
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeName, setCodeName] = useState('');
  const [gpu, setGpu] = useState('NVIDIA RTX 3060');
  const [vramGb, setVramGb] = useState(12);
  const [cpuCores, setCpuCores] = useState(32);
  const [ramGb, setRamGb] = useState(64);
  const [storage, setStorage] = useState('2TB NVMe');
  const [ipAddress, setIpAddress] = useState('192.168.1.50');
  const [sshPort, setSshPort] = useState(22);
  const [accessInstructions, setAccessInstructions] = useState('Acesse via SSH na rede local do laboratório.');
  const [isExclusive, setIsExclusive] = useState(false);

  const supabase = createClient();

  const loadData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      setUserEmail(user.email || '');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || profile?.role !== 'admin') {
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

  const resetForm = () => {
    setCodeName('');
    setGpu('NVIDIA RTX 3060');
    setVramGb(12);
    setCpuCores(32);
    setRamGb(64);
    setStorage('2TB NVMe');
    setIpAddress('192.168.1.50');
    setSshPort(22);
    setAccessInstructions('Acesse via SSH na rede local do laboratório.');
    setIsExclusive(false);
  };

  const handleCreateMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeName.trim()) {
      alert('Informe o identificador da máquina (ex: GEOCE-NODE-03).');
      return;
    }

    try {
      setSubmitting(true);
      const specs = {
        gpu,
        vram_gb: Number(vramGb),
        cpu_cores: Number(cpuCores),
        ram_gb: Number(ramGb),
        storage,
        ip_address: ipAddress,
        ssh_port: Number(sshPort),
        access_instructions: accessInstructions,
      };

      const { error } = await supabase.from('machines').insert({
        code_name: codeName.trim().toUpperCase(),
        specs,
        status: 'available',
        is_exclusive: isExclusive,
      });

      if (error) throw error;

      setShowAddModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Falha ao cadastrar nova máquina.');
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleDeleteMachine = async (machineId: string, name: string) => {
    if (!confirm(`Deseja realmente remover a máquina "${name}" do catálogo?`)) return;

    try {
      const { error } = await supabase.from('machines').delete().eq('id', machineId);
      if (error) {
        if (error.code === '23503') {
          alert('Esta máquina não pode ser excluída porque possui histórico de reservas vinculado a ela.');
        } else {
          throw error;
        }
        return;
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao deletar máquina.');
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
      const res = await fetch('/api/admin/users/quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: profileId, weeklyHoursLimit: newLimit }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Falha ao atualizar cota.');
      } else {
        alert(`Cota atualizada para ${newLimit}h com sucesso!`);
        loadData();
      }
    } catch (err: any) {
      alert(err.message || 'Falha ao comunicar com o servidor.');
    }
  };

  const updateUserRole = async (targetUserId: string, currentRole: string, targetName: string) => {
    const roles: UserRole[] = ['student', 'researcher', 'admin'];
    const newRole = prompt(
      `Definir papel para "${targetName}".\nDigite exatamente: student, researcher ou admin:`,
      currentRole
    )?.toLowerCase() as UserRole;

    if (!newRole || !roles.includes(newRole) || newRole === currentRole) return;

    try {
      const res = await fetch('/api/admin/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao alterar papel.');
      } else {
        alert(`Papel de ${targetName} alterado com sucesso para "${newRole}"!`);
        loadData();
      }
    } catch (err: any) {
      alert(err.message || 'Falha na comunicação.');
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

  // Visualização de Acesso Restrito para Usuários Não-Admin
  if (!isAdmin) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center max-w-lg mx-auto space-y-5 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <div>
          <h2 className="text-lg font-bold text-white">Acesso Restrito ao Painel de Gestão</h2>
          <p className="text-xs text-slate-400 mt-1">
            Esta área é exclusiva para a equipe de coordenação e gestores do Laboratório GEOCE.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800 font-mono text-xs text-slate-300">
            <span>{userEmail || 'Usuário Não Identificado'}</span>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-sans font-semibold">
              Papel: Pesquisador / Student
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 text-left space-y-2">
          <p className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            Como obter acesso de Administrador:
          </p>
          <p>
            1. <strong>Regra de Provedor / Servidor:</strong> Seu e-mail deve estar incluído na lista oficial <code>ADMIN_EMAILS</code> ou <code>ADMIN_ALERT_EMAIL</code> no ambiente do servidor.
          </p>
          <p>
            2. <strong>Regra de Banco SQL:</strong> Um administrador já cadastrado ou o gestor do banco de dados deve conceder o papel via <code>role = 'admin'</code> na tabela <code>public.profiles</code>.
          </p>
        </div>
      </div>
    );
  }

  // Painel Administrativo Autorizado
  return (
    <div className="space-y-8">
      {/* Banner de Destaque do Administrador */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-500/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Sessão Administrativa Autorizada</span>
              <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.2 rounded-full uppercase">
                ADMIN
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Identificado como: <strong className="text-slate-200">{userEmail}</strong> (Privilégios de Gestão Ativos)
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" /> Gestão de Nós & Usuários Liberada
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Gestão do Laboratório & Hardware
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cadastro de nós de GPU, controle de status e governança de cotas Fair Sharing.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/10"
          >
            <Plus className="w-3.5 h-3.5" />
            Cadastrar Nova Máquina
          </button>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl transition-all border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Machines Status Control */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            Inventário de Máquinas ({machines.length})
          </h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Código / Nó</th>
                <th className="py-3 px-4">GPU & VRAM</th>
                <th className="py-3 px-4">CPU & RAM</th>
                <th className="py-3 px-4">Rede / IP</th>
                <th className="py-3 px-4">Status Atual</th>
                <th className="py-3 px-4 text-right">Ações de Gestão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {machines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Nenhuma máquina cadastrada. Clique em "Cadastrar Nova Máquina" acima.
                  </td>
                </tr>
              ) : (
                machines.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-200">
                        <span>{m.code_name}</span>
                        {m.is_exclusive && (
                          <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.2 rounded">
                            Exclusiva
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{m.specs?.gpu || 'GPU Dedicada'}</span>
                        <span className="text-slate-500 font-mono">({m.specs?.vram_gb || 0}GB)</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      {m.specs?.cpu_cores || '-'} Cores | {m.specs?.ram_gb || '-'}GB RAM
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {m.specs?.ip_address ? `${m.specs.ip_address}:${m.specs.ssh_port || 22}` : 'Rede Local'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-mono uppercase text-[11px] px-2 py-0.5 rounded border ${
                        m.status === 'available'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : m.status === 'in_use'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => updateMachineStatus(m.id, 'available')}
                        title="Tornar Disponível"
                        className="px-2 py-1 rounded text-[11px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      >
                        Liberar
                      </button>
                      <button
                        onClick={() => updateMachineStatus(m.id, 'maintenance')}
                        title="Colocar em Manutenção"
                        className="px-2 py-1 rounded text-[11px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      >
                        Manutenção
                      </button>
                      <button
                        onClick={() => handleDeleteMachine(m.id, m.code_name)}
                        title="Excluir Nó"
                        className="p-1 rounded text-[11px] text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors inline-flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users & Role Management */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Usuários, Papéis & Ajuste de Cotas
        </h2>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Papel no Laboratório</th>
                <th className="py-3 px-4">Cota Semanal</th>
                <th className="py-3 px-4 text-right">Ações de Governança</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-semibold text-slate-200">{p.full_name}</td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{p.email}</td>
                  <td className="py-3 px-4">
                    <span className={`font-mono uppercase text-[10px] px-2 py-0.5 rounded font-bold border ${
                      p.role === 'admin'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : p.role === 'researcher'
                        ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {p.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-400">{p.weekly_hours_limit || 20}h</td>
                  <td className="py-3 px-4 text-right space-x-1.5">
                    {/* Botão de Alteração Segura de Papel */}
                    <button
                      onClick={() => updateUserRole(p.id, p.role, p.full_name)}
                      className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded border border-amber-500/20 transition-colors"
                      title="Promover ou Rebaixar Papel do Usuário"
                    >
                      <UserCog className="w-3 h-3" />
                      Alterar Papel
                    </button>

                    {/* Botão de Edição de Cota */}
                    <button
                      onClick={() => updateWeeklyQuota(p.id, p.weekly_hours_limit || 20)}
                      className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1 rounded transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      Cota
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Cadastro de Nova Máquina */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Cadastrar Nova Máquina / Estação</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMachine} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Código do Nó / Hostname *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: GEOCE-NODE-03"
                    value={codeName}
                    onChange={(e) => setCodeName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 uppercase font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Modelo da Placa de Vídeo (GPU) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: NVIDIA RTX 3060"
                    value={gpu}
                    onChange={(e) => setGpu(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Memória de Vídeo VRAM (GB) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={256}
                    value={vramGb}
                    onChange={(e) => setVramGb(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Núcleos de Processamento (CPU)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={cpuCores}
                    onChange={(e) => setCpuCores(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Memória RAM do Sistema (GB)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={ramGb}
                    onChange={(e) => setRamGb(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Armazenamento (Disco)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 2TB NVMe"
                    value={storage}
                    onChange={(e) => setStorage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Endereço IP (Rede Local do Lab)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 192.168.1.50"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Porta SSH / RDP
                  </label>
                  <input
                    type="number"
                    value={sshPort}
                    onChange={(e) => setSshPort(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Instruções de Acesso para o Aluno
                </label>
                <textarea
                  rows={2}
                  value={accessInstructions}
                  onChange={(e) => setAccessInstructions(e.target.value)}
                  placeholder="Ex: Conecte via SSH: ssh lab@192.168.1.50 -p 22. Solicite a chave privada ao administrador."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="exclusive"
                  checked={isExclusive}
                  onChange={(e) => setIsExclusive(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="exclusive" className="text-slate-300 cursor-pointer">
                  Nó exclusivo (apenas pesquisadores/projetos prioritários)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar Máquina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
