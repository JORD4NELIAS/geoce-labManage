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
  ExternalLink,
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

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Redireciona para login se não autenticado
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, role')
        .eq('id', user.id)
        .single();

      setUserProfile({
        fullName: profile?.full_name || user.user_metadata?.full_name || 'Pesquisador',
        email: user.email || '',
        role: profile?.role || 'student',
      });
    }

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
                GEOCE LabLicence
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

            {/* Admin Links */}
            {userProfile?.role === 'admin' && (
              <div className="pt-5 space-y-1">
                <div className="text-[11px] font-semibold text-amber-500/80 uppercase px-3 mb-2 tracking-wider">
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
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <QuotaTracker usedHours={usedHours} limitHours={limitHours} />

          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                <User className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-200 truncate">
                  {userProfile?.fullName || 'Carregando...'}
                </p>
                <p className="text-[10px] text-slate-400 capitalize">
                  {userProfile?.role || 'Pesquisador'}
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
            <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Supabase Realtime Ativo
            </span>
          </div>
        </header>

        <main className="p-8 max-w-7xl w-full mx-auto flex-1">{children}</main>
      </div>
    </div>
  );
}
