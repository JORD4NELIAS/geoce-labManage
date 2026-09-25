'use client';

import React from 'react';
import { Clock, ShieldAlert, CheckCircle } from 'lucide-react';

interface QuotaTrackerProps {
  usedHours: number;
  limitHours: number;
  maxSessionHours?: number;
}

export default function QuotaTracker({
  usedHours = 0,
  limitHours = 20,
  maxSessionHours = 4,
}: QuotaTrackerProps) {
  const percentage = Math.min(100, Math.round((usedHours / limitHours) * 100));
  const remainingHours = Math.max(0, limitHours - usedHours);

  const getStatusColor = () => {
    if (percentage >= 90) return 'bg-rose-500 text-rose-400 border-rose-500/20';
    if (percentage >= 70) return 'bg-amber-500 text-amber-400 border-amber-500/20';
    return 'bg-emerald-500 text-emerald-400 border-emerald-500/20';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Cota Semanal (Fair Sharing)
          </span>
        </div>
        <span className="text-xs font-medium text-slate-400">
          {usedHours.toFixed(1)}h / {limitHours}h ({percentage}%)
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full transition-all duration-500 ${
            percentage >= 90
              ? 'bg-rose-500'
              : percentage >= 70
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Restante: <strong className="text-slate-200">{remainingHours.toFixed(1)}h</strong></span>
        <span>Máx. sessão: <strong className="text-slate-200">{maxSessionHours}h contínuas</strong></span>
      </div>

      {percentage >= 100 && (
        <div className="mt-3 p-2 bg-rose-500/10 border border-rose-500/30 rounded text-[11px] text-rose-300 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Limite semanal atingido. Novas horas serão liberadas na próxima janela semanal.</span>
        </div>
      )}
    </div>
  );
}
