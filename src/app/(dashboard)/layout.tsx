'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import QuotaTracker from '@/components/QuotaTracker';
import { useUserQuota } from '@/hooks/useUserQuota';
import {
  Cpu,
  LayoutDashboard,
  Clock,
  PlusCircle,
  ShieldAlert,
  BarChart3,
  LogOut,
  User,
  ShieldCheck,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<{
    fullName: string;
    email: string;
    role: string;
  } | null>(null);

  const { usedHours, limitHours } = useUserQuota();
  const supabase = createClient();

  const loadUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('full_name, email, role')
      .eq('id', user.id)
      .single();

    if (error) {
      console.warn('[Layout loadUser] Erro ao carregar perfil do Supabase:', error.message);
    }

    setUserProfile({
      fullName: profile?.full_name || user.user_metadata?.full_name || 'Pesquisador',
      email: user.email || '',
      role: profile?.role || 'student',
    });
  };

  useEffect(() => {
    loadUser();
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { label: 'Máquinas & GPUs', href: '/', icon: LayoutDashboard },
    { label: 'Fila FIFO ao Vivo', href: '/queue', icon: Clock },
    { label: 'Nova Reserva', href: '/reserve', icon: PlusCircle },
  ];

  const adminItems = [
    { label: 'Gestão do Laboratório', href: '/admin', icon: ShieldAlert },
    { label: 'Métricas & Relatórios', href: '/admin/metrics', icon: BarChart3 },
  ];

  const isAdmin = userProfile?.role === 'admin';

  return (
    <div className="min-h-screen flex bg-[#0B0F17] text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800/80 bg-slate-950/60 flex flex-col justify-between p-4 sticky top-0 h-screen">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 py-4 mb-6 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Cpu className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">
                GEOCE LabManage
              </h1>
              <p className="text-[10px] text-emerald-400 font-mono">UFC Hardware Cloud</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase px-3 mb-2 tracking-wider">
              Menu Principal
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Admin Links — Visíveis estritamente apenas para administradores */}
            {isAdmin && (
              <div className="pt-5 space-y-1">
                <div className="text-[11px] font-semibold text-amber-500/90 uppercase px-3 mb-2 tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  Administração
                </div>
                {adminItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* User Quota & Profile Box */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <QuotaTracker usedHours={usedHours} limitHours={limitHours} />

          {/* User Profile Card */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${
                  isAdmin 
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}>
                  <User className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {userProfile?.fullName || 'Carregando...'}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate font-mono">
                    {userProfile?.email || ''}
                  </p>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                title="Sair da conta"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Destaque do papel / role */}
            <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Papel:</span>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  ADMINISTRADOR
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  PESQUISADOR
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Painel de Operações GEOCE
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {/* Destaque do usuário no header */}
            <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-slate-300 font-mono text-[11px] hidden sm:inline">
                {userProfile?.email}
              </span>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  ADMIN
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  PESQUISADOR
                </span>
              )}
            </div>

            <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Realtime Ativo
            </span>
          </div>
        </header>

        <main className="p-8 max-w-7xl w-full mx-auto flex-1">{children}</main>
      </div>
    </div>
  );
}
