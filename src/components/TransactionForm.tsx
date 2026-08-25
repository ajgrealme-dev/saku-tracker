import { useState, useEffect } from 'react';
import { db, formatRupiah, parseRupiah, type Envelope } from '../models/db';
import { X, AlertTriangle, PlusCircle, MinusCircle, Calendar, Calculator, Check } from 'lucide-react';

interface TransactionFormProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: 'income' | 'expense';
  defaultDate?: string; // YYYY-MM-DD
}

export default function TransactionForm({
  onClose,
  onSuccess,
  defaultType = 'expense',
  defaultDate,
}: TransactionFormProps) {
  const [type, setType] = useState<'income' | 'expense'>(defaultType);
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string>('auto_split');
  const [transactionDate, setTransactionDate] = useState<string>(
    defaultDate || new Date().toISOString().slice(0, 10)
  );
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Bi-Weekly HL Working Days Calculator State
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [workingDays, setWorkingDays] = useState<string>('12'); // default 12 days in 2 weeks
  const [dailyRate, setDailyRate] = useState<string>(formatRupiah(150000)); // default Rp 150.000 / day
  const [overtimePay, setOvertimePay] = useState<string>('0');

  useEffect(() => {
    // Load envelopes to populate dropdown
    const fetchEnvelopes = async () => {
      const data = await db.envelopes.toArray();
      setEnvelopes(data);
      if (data.length > 0 && defaultType === 'expense') {
        setSelectedEnvelopeId(data[0].id);
      }
    };
    fetchEnvelopes();
  }, [defaultType]);

  // Live validation for low-budget alerts
  useEffect(() => {
    if (type === 'expense' && selectedEnvelopeId && selectedEnvelopeId !== 'auto_split' && amount) {
      const parsedAmount = parseRupiah(amount);
      if (parsedAmount <= 0) {
        setWarningMessage(null);
        return;
      }

      const env = envelopes.find((e) => e.id === selectedEnvelopeId);
      if (env) {
        const remaining = env.currentBalance - parsedAmount;
        if (remaining < 0) {
          setWarningMessage(
            `⚠️ Peringatan: Saldo tidak cukup! Saldo saat ini Rp ${env.currentBalance.toLocaleString(
              'id-ID'
            )}. Anda akan defisit sebesar Rp ${Math.abs(remaining).toLocaleString('id-ID')}.`
          );
        } else if (remaining < env.targetAmount * 0.15 && env.targetAmount > 0) {
          setWarningMessage(
            `⚠️ Perhatian: Transaksi ini akan menyisakan saldo amplop kurang dari 15% (Sisa Rp ${remaining.toLocaleString(
              'id-ID'
            )}).`
          );
        } else {
          setWarningMessage(null);
        }
      }
    } else {
      setWarningMessage(null);
    }
  }, [type, selectedEnvelopeId, amount, envelopes]);

  // Quick Amount Handlers
  const handleQuickAddAmount = (addVal: number) => {
    const current = parseRupiah(amount);
    setAmount(formatRupiah(current + addVal));
  };

  const handleSetExactAmount = (val: number) => {
    setAmount(formatRupiah(val));
  };

  // Apply calculated wage from Bi-Weekly working days
  const handleApplyCalculator = () => {
    const days = parseFloat(workingDays) || 0;
    const rate = parseRupiah(dailyRate);
    const ot = parseRupiah(overtimePay);
    const totalWage = (days * rate) + ot;

    if (totalWage <= 0) {
      alert('Total hitungan upah harus lebih dari 0.');
      return;
    }

    setAmount(formatRupiah(totalWage));
    setDescription(`Transfer Gajian 2 Mingguan (${days} Hari Masuk Kerja${ot > 0 ? ' + Lembur' : ''})`);
    setShowCalculator(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseRupiah(amount);

    if (parsedAmount <= 0) {
      alert('Jumlah uang harus lebih dari 0');
      return;
    }

    if (!description.trim()) {
      alert('Deskripsi transaksi tidak boleh kosong');
      return;
    }

    setIsSubmitting(true);

    try {
      const dateTimestamp = new Date(transactionDate + 'T12:00:00').getTime();

      if (type === 'expense') {
        const env = await db.envelopes.get(selectedEnvelopeId);
        if (!env) throw new Error('Amplop tidak ditemukan');

        const newBalance = env.currentBalance - parsedAmount;

        await db.transaction('rw', [db.envelopes, db.transactions], async () => {
          await db.envelopes.update(selectedEnvelopeId, { currentBalance: newBalance });
          await db.transactions.add({
            envelopeId: selectedEnvelopeId,
            type: 'expense',
            amount: parsedAmount,
            description: description,
            date: dateTimestamp,
          });
        });
      } else {
        // Income (Transfer Gajian Masuk)
        await db.transaction('rw', [db.envelopes, db.transactions], async () => {
          const envs = await db.envelopes.toArray();

          // Add parent income transaction
          await db.transactions.add({
            envelopeId: selectedEnvelopeId === 'auto_split' ? undefined : selectedEnvelopeId,
            type: 'income',
            amount: parsedAmount,
            description: description,
            date: dateTimestamp,
          });

          if (selectedEnvelopeId === 'auto_split') {
            // Distribute proportionally based on envelope target amounts
            const totalTarget = envs.reduce((sum, e) => sum + (e.targetAmount || 0), 0);

            for (const env of envs) {
              const portion = totalTarget > 0 ? (env.targetAmount / totalTarget) : (1 / envs.length);
              const splitAmount = Math.round(parsedAmount * portion);
              await db.envelopes.update(env.id, {
                currentBalance: env.currentBalance + splitAmount,
              });
            }
          } else {
            // Allocate directly to chosen envelope
            const chosenEnv = await db.envelopes.get(selectedEnvelopeId);
            if (chosenEnv) {
              await db.envelopes.update(selectedEnvelopeId, {
                currentBalance: chosenEnv.currentBalance + parsedAmount,
              });
            }
          }
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Gagal mencatat transaksi.');
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
            {type === 'expense' ? '💸 Catat Pengeluaran' : '💰 Catat Transfer Gajian Masuk'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Toggle Type */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                if (envelopes.length > 0 && selectedEnvelopeId === 'auto_split') {
                  setSelectedEnvelopeId(envelopes[0].id);
                }
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-extrabold rounded-lg transition-all ${
                type === 'expense'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              <MinusCircle size={15} />
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setSelectedEnvelopeId('auto_split');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-extrabold rounded-lg transition-all ${
                type === 'income'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              <PlusCircle size={15} />
              Gajian / Uang Masuk
            </button>
          </div>

          {/* Bi-Weekly Wage Calculator Accordion (Income Only) */}
          {type === 'income' && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCalculator(!showCalculator)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Calculator size={15} />
                  <span>Kalkulator Upah 2 Mingguan (Hitung Hari Kerja)</span>
                </div>
                <span className="text-[10px] underline">{showCalculator ? 'Tutup' : 'Buka Hitungan'}</span>
              </button>

              {showCalculator && (
                <div className="p-4 pt-1 space-y-3 border-t border-emerald-200/60 dark:border-emerald-900/40 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                        Hari Masuk Kerja (dlm 2 mg)
                      </label>
                      <input
                        type="number"
                        value={workingDays}
                        onChange={(e) => setWorkingDays(e.target.value)}
                        placeholder="Contoh: 12"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-lg font-bold text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                        Upah Harian (Rp)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={dailyRate}
                        onChange={(e) => setDailyRate(formatRupiah(e.target.value))}
                        placeholder="150.000"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-lg font-bold text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                      Uang Lembur / Bonus Tambahan (Rp)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={overtimePay}
                      onChange={(e) => setOvertimePay(formatRupiah(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-lg font-bold text-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Total Estimasi Transfer:</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        Rp {(((parseFloat(workingDays) || 0) * parseRupiah(dailyRate)) + parseRupiah(overtimePay)).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyCalculator}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-sm"
                    >
                      <Check size={13} />
                      Pakai Hasil Ini
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} />
              Tanggal Transaksi
            </label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Amount Input with Auto Thousand Dots (.) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Nominal Uang
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(formatRupiah(e.target.value))}
                placeholder="0"
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex gap-1.5 flex-wrap mt-2">
              {type === 'income' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSetExactAmount(1000000)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                  >
                    1 Juta
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExactAmount(1500000)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                  >
                    1.5 Juta
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExactAmount(1800000)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                  >
                    1.8 Juta
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExactAmount(2000000)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                  >
                    2 Juta
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExactAmount(2500000)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                  >
                    2.5 Juta
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddAmount(100000)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all"
                  >
                    +100rb
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleSetExactAmount(10000)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all"
                  >
                    10rb
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExactAmount(20000)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all"
                  >
                    20rb
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExactAmount(35000)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all"
                  >
                    35rb
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExactAmount(50000)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all"
                  >
                    50rb
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExactAmount(100000)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all"
                  >
                    100rb
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Envelope Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              {type === 'expense' ? 'Pos Amplop Pengeluaran' : 'Tujuan Alokasi Uang Masuk'}
            </label>
            <select
              value={selectedEnvelopeId}
              onChange={(e) => setSelectedEnvelopeId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              {type === 'income' && (
                <option value="auto_split">
                  ✨ Bagi Proporsional ke Seluruh Amplop Target
                </option>
              )}
              {envelopes.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name} (Sisa: Rp {env.currentBalance.toLocaleString('id-ID')} / Target: Rp {env.targetAmount.toLocaleString('id-ID')})
                </option>
              ))}
            </select>
          </div>

          {/* Description Input & Suggestions */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Keterangan
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === 'expense'
                  ? 'contoh: Nasi padang, Beli Kuota 50GB, Bensin Pertalite'
                  : 'contoh: Transfer Gajian 2 Mingguan Periode 1'
              }
              required
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Warning Message */}
          {warningMessage && (
            <div className="flex gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{warningMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black text-white shadow-md transition-all ${
                type === 'expense'
                  ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
                  : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
              } disabled:opacity-50`}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
