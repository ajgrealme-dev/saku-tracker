import { useState, useEffect } from 'react';
import { db, formatRupiah, parseRupiah, type Envelope } from '../models/db';
import {
  X,
  Trash2,
  Save,
  PlusCircle,
  Heart,
  PiggyBank,
  ShieldAlert,
  Coffee,
  Flame,
  Fuel,
  ShoppingBag,
  Home,
  Zap,
  Smartphone,
  Car,
  Sparkles,
  GraduationCap,
  Stethoscope,
  Coins
} from 'lucide-react';

const AVAILABLE_ICONS = [
  { name: 'Heart', label: 'ZIS / Sedekah', icon: Heart },
  { name: 'Smartphone', label: 'Kuota / Pulsa', icon: Smartphone },
  { name: 'Fuel', label: 'Bensin', icon: Fuel },
  { name: 'Flame', label: 'Rokok', icon: Flame },
  { name: 'Coffee', label: 'Jajan / Makan', icon: Coffee },
  { name: 'ShoppingBag', label: 'Belanja', icon: ShoppingBag },
  { name: 'PiggyBank', label: 'Tabungan', icon: PiggyBank },
  { name: 'ShieldAlert', label: 'Dana Darurat', icon: ShieldAlert },
  { name: 'Home', label: 'Rumah / Kost', icon: Home },
  { name: 'Zap', label: 'Listrik / Token', icon: Zap },
  { name: 'Car', label: 'Kendaraan / Cicilan', icon: Car },
  { name: 'Sparkles', label: 'Self Care', icon: Sparkles },
  { name: 'GraduationCap', label: 'Pendidikan', icon: GraduationCap },
  { name: 'Stethoscope', label: 'Kesehatan', icon: Stethoscope },
  { name: 'Coins', label: 'Lain-lain', icon: Coins },
];

const COLOR_OPTIONS = [
  { id: 'emerald', bg: 'bg-emerald-500', name: 'Hijau (ZIS)' },
  { id: 'cyan', bg: 'bg-cyan-500', name: 'Cyan (Kuota)' },
  { id: 'blue', bg: 'bg-blue-500', name: 'Biru (Bensin)' },
  { id: 'rose', bg: 'bg-rose-500', name: 'Merah (Rokok)' },
  { id: 'amber', bg: 'bg-amber-500', name: 'Kuning (Jajan)' },
  { id: 'purple', bg: 'bg-purple-500', name: 'Ungu (Belanja)' },
  { id: 'indigo', bg: 'bg-indigo-500', name: 'Indigo (Tabungan)' },
];

interface EnvelopeModalProps {
  envelopeToEdit?: Envelope | null; // If null, mode is Add
  onClose: () => void;
  onSuccess: () => void;
}

export default function EnvelopeModal({ envelopeToEdit, onClose, onSuccess }: EnvelopeModalProps) {
  const isEditing = !!envelopeToEdit;

  const [name, setName] = useState<string>(envelopeToEdit?.name || '');
  const [allocatedPercentage, setAllocatedPercentage] = useState<string>(
    envelopeToEdit ? (envelopeToEdit.allocatedPercentage ?? 10).toString() : '10'
  );
  const [currentBalance, setCurrentBalance] = useState<string>(
    envelopeToEdit ? formatRupiah(envelopeToEdit.currentBalance) : '0'
  );
  const [selectedColor, setSelectedColor] = useState<string>(envelopeToEdit?.color || 'blue');
  const [selectedIcon, setSelectedIcon] = useState<string>(envelopeToEdit?.icon || 'Coins');
  const [referenceIncome, setReferenceIncome] = useState<number>(1250000); // Baseline wage for live shadow preview
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch reference income from DB
  useEffect(() => {
    const loadReferenceIncome = async () => {
      const incObj = await db.settings.get('monthly_income');
      if (incObj?.value && incObj.value > 0) {
        setReferenceIncome(incObj.value);
      }
    };
    loadReferenceIncome();
  }, []);

  const parsedPercentage = parseFloat(allocatedPercentage) || 0;
  
  // Live Shadow Preview calculation (Bayangan Nominal Alokasi)
  const bayanganNominal = Math.round((referenceIncome * parsedPercentage) / 100);

  const handlePercentageChange = (val: string) => {
    setAllocatedPercentage(val);
  };

  const handleQuickAddPercentage = (delta: number) => {
    const updated = Math.max(0, Math.min(100, parsedPercentage + delta));
    setAllocatedPercentage((Math.round(updated * 10) / 10).toString());
  };

  const handleSetExactPercentage = (val: number) => {
    setAllocatedPercentage(val.toString());
  };

  // Apply shadow nominal into current balance input
  const handleApplyShadowToBalance = () => {
    setCurrentBalance(formatRupiah(bayanganNominal));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Nama alokasi tidak boleh kosong.');
      return;
    }

    const percentageNum = parseFloat(allocatedPercentage) || 0;
    const balanceNum = parseRupiah(currentBalance);

    setIsSubmitting(true);

    try {
      if (isEditing && envelopeToEdit) {
        // Update existing envelope
        await db.envelopes.update(envelopeToEdit.id, {
          name: name.trim(),
          allocatedPercentage: percentageNum,
          targetAmount: bayanganNominal > 0 ? bayanganNominal : 100000,
          currentBalance: balanceNum,
          color: selectedColor,
          icon: selectedIcon,
        });
      } else {
        // Create new unique envelope ID
        const generatedId = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();

        const newEnvelope: Envelope = {
          id: generatedId,
          name: name.trim(),
          allocatedPercentage: percentageNum,
          targetAmount: bayanganNominal > 0 ? bayanganNominal : 100000,
          currentBalance: balanceNum,
          color: selectedColor,
          icon: selectedIcon,
        };

        await db.envelopes.add(newEnvelope);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving envelope:', err);
      alert('Gagal menyimpan pos alokasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!envelopeToEdit) return;

    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus pos alokasi "${envelopeToEdit.name}"? Transaksi yang terkait tidak akan dihapus, namun amplop ini akan hilang dari daftar.`
    );
    if (!confirmDelete) return;

    setIsSubmitting(true);
    try {
      await db.envelopes.delete(envelopeToEdit.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error deleting envelope:', err);
      alert('Gagal menghapus pos alokasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up sm:animate-fade-in border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 shrink-0">
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            {isEditing ? '✏️ Edit Pos Alokasi' : '✨ Tambah Pos Alokasi Baru'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* Envelope Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Nama Pos Alokasi / Amplop
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Bensin & Transportasi, ZIS, Jajan"
              required
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Persentase Alokasi (%) & Saldo Saat Ini (Rp) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Persentase Alokasi (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={allocatedPercentage}
                  onChange={(e) => handlePercentageChange(e.target.value)}
                  placeholder="10"
                  required
                  className="w-full pl-3.5 pr-7 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                  %
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Saldo Saat Ini (Rp)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={currentBalance}
                  onChange={(e) => setCurrentBalance(formatRupiah(e.target.value))}
                  placeholder="0"
                  required
                  className="w-full pl-3.5 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Bayangan Nominal Alokasi (Live Shadow Preview) */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200/80 dark:border-indigo-800/60 space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-500 animate-pulse" />
                <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                  Bayangan Nominal Alokasi:
                </span>
              </div>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                ≈ Rp {bayanganNominal.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
              <span>(Dihitung dari upah: Rp {referenceIncome.toLocaleString('id-ID')})</span>
              <button
                type="button"
                onClick={handleApplyShadowToBalance}
                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Gunakan sbg Saldo
              </button>
            </div>
          </div>

          {/* Quick Percentage Chips */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-400 block font-semibold">Pilih Cepat Persentase:</span>
            <div className="flex gap-1.5 flex-wrap">
              {[2.5, 5, 10, 12.5, 15, 20, 25, 30].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleSetExactPercentage(pct)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    parsedPercentage === pct
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {pct}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleQuickAddPercentage(-1)}
                className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-[10px]"
              >
                -1%
              </button>
              <button
                type="button"
                onClick={() => handleQuickAddPercentage(1)}
                className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-[10px]"
              >
                +1%
              </button>
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Warna Identitas Pos
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColor(c.id)}
                  className={`w-7 h-7 rounded-full ${c.bg} flex items-center justify-center transition-all ${
                    selectedColor === c.id
                      ? 'ring-4 ring-indigo-500/30 scale-110 shadow-md'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  title={c.name}
                >
                  {selectedColor === c.id && <div className="w-2 h-2 rounded-full bg-white shadow-sm" />}
                </button>
              ))}
            </div>
          </div>

          {/* Icon Selection Grid */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Pilih Icon Amplop
            </label>
            <div className="grid grid-cols-5 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
              {AVAILABLE_ICONS.map((item) => {
                const IconComp = item.icon;
                const isSelected = selectedIcon === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setSelectedIcon(item.name)}
                    className={`p-2.5 rounded-xl flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md scale-105'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                    title={item.label}
                  >
                    <IconComp size={18} />
                    <span className="text-[9px] truncate max-w-full font-medium">{item.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="py-3 px-3.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white active:scale-95 transition-all flex items-center justify-center gap-1 font-black shrink-0 text-[11px]"
                title="Hapus Pos Alokasi Ini"
              >
                <Trash2 size={16} />
                <span>Hapus</span>
              </button>
            )}
            
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 text-slate-300 hover:bg-slate-800 active:scale-95 transition-all text-xs"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-3 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 shadow-md shadow-indigo-950 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 text-xs"
            >
              {isEditing ? <Save size={15} /> : <PlusCircle size={15} />}
              {isEditing ? 'Simpan' : 'Tambah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
