'use client';

import React from 'react';
import Link from 'next/link';
import { Cpu, HardDrive, MemoryStick as Ram, Server, Zap, Lock } from 'lucide-react';
import { MachineStatus } from '@/types/database';

interface MachineProps {
  machine: {
    id: string;
    code_name: string;
    specs: {
      gpu?: string;
      vram_gb?: number;
      cpu_cores?: number;
      ram_gb?: number;
      storage?: string;
    };
    status: MachineStatus;
    is_exclusive: boolean;
  };
}

export default function MachineCard({ machine }: MachineProps) {
  const getStatusBadge = (status: MachineStatus) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Disponível
          </span>
        );
      case 'in_use':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Em Uso
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Manutenção
          </span>
        );
      case 'offline':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Offline
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all rounded-2xl p-5 shadow-xl flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-wide">
                {machine.code_name}
              </h3>
              {machine.is_exclusive && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5" /> Exclusivo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Estação de Alto Desempenho</p>
          </div>
          {getStatusBadge(machine.status)}
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-5 text-xs text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="truncate" title={machine.specs.gpu || 'GPU'}>
              {machine.specs.gpu || 'GPU Dedicada'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <span>{machine.specs.vram_gb ? `${machine.specs.vram_gb} GB VRAM` : 'VRAM N/A'}</span>
          </div>

          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{machine.specs.cpu_cores ? `${machine.specs.cpu_cores} Cores` : 'CPU N/A'}</span>
          </div>

          <div className="flex items-center gap-2">
            <Ram className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <span>{machine.specs.ram_gb ? `${machine.specs.ram_gb} GB RAM` : 'RAM N/A'}</span>
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <div>
        {machine.status === 'available' ? (
          <Link
            href={`/reserve?machine_id=${machine.id}`}
            className="w-full py-2.5 px-4 rounded-xl text-center text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
          >
            Reservar Imediatamente
          </Link>
        ) : machine.status === 'in_use' ? (
          <Link
            href={`/reserve?machine_id=${machine.id}`}
            className="w-full py-2.5 px-4 rounded-xl text-center text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all flex items-center justify-center gap-1.5"
          >
            Entrar na Fila FIFO
          </Link>
        ) : (
          <button
            disabled
            className="w-full py-2.5 px-4 rounded-xl text-center text-xs font-semibold bg-slate-800 text-slate-500 cursor-not-allowed"
          >
            Indisponível no Momento
          </button>
        )}
      </div>
    </div>
  );
}
