import type { Envelope } from '../models/db';
import * as Icons from 'lucide-react';
import { Pencil } from 'lucide-react';

const colorMap: Record<string, {
  bg: string;
  text: string;
  border: string;
  bar: string;
  lightBar: string;
  badge: string;
}> = {
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-100 dark:border-emerald-950/50',
    bar: 'bg-emerald-500',
    lightBar: 'bg-emerald-100 dark:bg-emerald-900/20',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/20',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-100 dark:border-indigo-950/50',
    bar: 'bg-indigo-500',
    lightBar: 'bg-indigo-100 dark:bg-indigo-900/20',
    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/20',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-100 dark:border-purple-950/50',
    bar: 'bg-purple-500',
    lightBar: 'bg-purple-100 dark:bg-purple-900/20',
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-100 dark:border-amber-950/50',
    bar: 'bg-amber-500',
    lightBar: 'bg-amber-100 dark:bg-amber-900/20',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-100 dark:border-rose-950/50',
    bar: 'bg-rose-500',
    lightBar: 'bg-rose-100 dark:bg-rose-900/20',
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/20',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-100 dark:border-cyan-950/50',
    bar: 'bg-cyan-500',
    lightBar: 'bg-cyan-100 dark:bg-cyan-900/20',
    badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-100 dark:border-blue-950/50',
    bar: 'bg-blue-500',
    lightBar: 'bg-blue-100 dark:bg-blue-900/20',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
};

interface BudgetEnvelopeProps {
  envelope: Envelope;
  onClick?: () => void;
  onEdit?: (envelope: Envelope) => void;
}

export default function BudgetEnvelope({ envelope, onClick, onEdit }: BudgetEnvelopeProps) {
  const colors = colorMap[envelope.color] || colorMap.blue;
  
  // Dynamic Icon selector
  const IconComponent = (Icons as any)[envelope.icon] || Icons.Coins;

  const percentageRate = envelope.allocatedPercentage || 10;
  const current = envelope.currentBalance || 0;
  const target = envelope.targetAmount || 100000;
  
  let gaugePercent = 0;
  if (target > 0) {
    gaugePercent = Math.max(0, Math.min(100, (current / target) * 100));
  } else if (current > 0) {
    gaugePercent = 100;
  }

  const isLow = target > 0 && current < target * 0.15 && current > 0;
  const isDeficit = current < 0;
  const isEmpty = current === 0;

  return (
    <div
      onClick={onClick}
      className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer flex flex-col justify-between group"
    >
      {/* Header Info */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2.5 rounded-xl ${colors.bg} ${colors.text} shrink-0`}>
            <IconComponent size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
              {envelope.name}
            </h3>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
              Alokasi: {percentageRate}%
            </span>
          </div>
        </div>
        
        {/* Right side: Status Indicators & Edit Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isDeficit && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 animate-pulse uppercase tracking-wider">
              Defisit
            </span>
          )}
          {isEmpty && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Kosong
            </span>
          )}
          {isLow && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 uppercase tracking-wider">
              Tipis
            </span>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // prevent card click
                onEdit(envelope);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-indigo-400 transition-colors"
              title="Edit Pos Alokasi"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Financial Numbers */}
      <div className="mt-4 mb-2 flex justify-between items-baseline">
        <div className="text-xs text-slate-400 dark:text-slate-500">Saldo Sisa</div>
        <div className="text-right">
          <span className={`text-base font-black ${isDeficit ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
            Rp {current.toLocaleString('id-ID')}
          </span>
          <div className="text-[10px] text-slate-400">
            Porsi: {percentageRate}%
          </div>
        </div>
      </div>

      {/* Progress Bar Gauge */}
      <div className="w-full space-y-1">
        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isDeficit ? 'bg-rose-500' : isLow ? 'bg-amber-500' : colors.bar
            }`}
            style={{ width: `${gaugePercent}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
          <span>{Math.round(gaugePercent)}% Terisi</span>
          <span>{isDeficit ? 'Terlampaui' : `Sisa Rp ${current.toLocaleString('id-ID')}`}</span>
        </div>
      </div>
    </div>
  );
}
