import { useState, useEffect } from 'react';
import { db, formatRupiah, parseRupiah, type Envelope } from '../models/db';
import { Sparkles, Save, Wallet } from 'lucide-react';

interface SetupDialogProps {
  onSuccess: () => void;
}

export default function SetupDialog({ onSuccess }: SetupDialogProps) {
  const [income, setIncome] = useState<string>('0'); // Starting balance (optional)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [totalTarget, setTotalTarget] = useState<number>(0);

  useEffect(() => {
    const fetchEnvelopes = async () => {
      const data = await db.envelopes.toArray();
      setEnvelopes(data);
    };
    fetchEnvelopes();
  }, []);

  useEffect(() => {
    const total = envelopes.reduce((sum, env) => sum + (env.targetAmount || 0), 0);
    setTotalTarget(total);
  }, [envelopes]);

  const handleTargetChange = (id: string, formattedVal: string) => {
    const parsedVal = parseRupiah(formattedVal);

    setEnvelopes((prev) =>
      prev.map((env) => (env.id === id ? { ...env, targetAmount: parsedVal } : env))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedIncome = parseRupiah(income);

    try {
      await db.transaction('rw', [db.envelopes, db.transactions, db.settings], async () => {
        if (parsedIncome > 0) {
          // Save initial income in transactions
          await db.transactions.add({
            type: 'income',
            amount: parsedIncome,
            description: 'Saldo Awal / Dana Setup',
            date: Date.now(),
          });
        }

        // Update envelopes with new nominal targets
        for (const env of envelopes) {
          await db.envelopes.update(env.id, {
            targetAmount: env.targetAmount,
            currentBalance: 0, // start fresh or user can edit
          });
        }

        // Set state in settings
        await db.settings.put({ key: 'has_setup', value: true });
      });

      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan setup awal.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
        
        {/* Welcome Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
            <Sparkles size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Tentukan Nominal Pos Amplop Anda 💰
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Atur target nominal budget yang Anda butuhkan per bulan (misal: ZIS Rp 100.000, Kuota Rp 100.000, Bensin Rp 150.000, dll.).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Total Monthly Target HUD */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-200 dark:border-indigo-900/50 flex justify-between items-center">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Target Kebutuhan Bulanan
              </span>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                Rp {totalTarget.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-indigo-600 text-white">
              <Wallet size={20} />
            </div>
          </div>

          {/* Envelope Target List */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Sesuaikan Nominal Target Per Amplop:
              </h2>
            </div>

            <div className="max-h-64 overflow-y-auto pr-1 space-y-2.5">
              {envelopes.map((env) => (
                <div
                  key={env.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      {env.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Target anggaran per bulan
                    </div>
                  </div>

                  <div className="relative w-36 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatRupiah(env.targetAmount)}
                      onChange={(e) => handleTargetChange(env.id, e.target.value)}
                      placeholder="100.000"
                      className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-black text-right text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Starting Balance */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Saldo Tunai Awal Saat Ini (Opsional / Boleh 0)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={income}
                onChange={(e) => setIncome(formatRupiah(e.target.value))}
                placeholder="0"
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all"
          >
            <Save size={16} />
            Simpan Target Anggaran
          </button>
        </form>
      </div>
    </div>
  );
}
