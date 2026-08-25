import { useState, useEffect } from 'react';
import { db, initializeDefaultData, type Envelope, type Transaction } from './models/db';
import BudgetEnvelope from './components/BudgetEnvelope';
import TransactionForm from './components/TransactionForm';
import EnvelopeModal from './components/EnvelopeModal';
import SetupDialog from './components/SetupDialog';
import {
  Wallet,
  Plus,
  History as HistoryIcon,
  Settings as SettingsIcon,
  AlertCircle,
  Trash2,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Calendar,
  BadgeCheck,
  CreditCard,
  FolderPlus
} from 'lucide-react';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function App() {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [hasSetup, setHasSetup] = useState<boolean>(false);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Active Month & Year Filter (Default: Current date)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  // Navigation & Dialog States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
  const [showTransactionForm, setShowTransactionForm] = useState<boolean>(false);
  const [formType, setFormType] = useState<'income' | 'expense'>('expense');
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string>('all');
  const [filterAllMonths, setFilterAllMonths] = useState<boolean>(false);

  // Envelope Add/Edit Modal State
  const [showEnvelopeModal, setShowEnvelopeModal] = useState<boolean>(false);
  const [envelopeToEdit, setEnvelopeToEdit] = useState<Envelope | null>(null);

  // Load and refresh all app state from DB
  const refreshAppData = async () => {
    try {
      await initializeDefaultData();
      
      const setupObj = await db.settings.get('has_setup');
      const isSetup = setupObj?.value === true;
      setHasSetup(isSetup);

      if (isSetup) {
        const envList = await db.envelopes.toArray();
        const txList = await db.transactions.orderBy('date').reverse().toArray();
        setEnvelopes(envList);
        setTransactions(txList);
      }
    } catch (err) {
      console.error('Error refreshing app data:', err);
    } finally {
      setIsInitialized(true);
    }
  };

  useEffect(() => {
    refreshAppData();
  }, []);

  // Month Navigation Handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth());
  };

  const isCurrentMonthActive =
    selectedYear === new Date().getFullYear() && selectedMonth === new Date().getMonth();

  // Filter transactions by the selected month
  const currentMonthTransactions = transactions.filter((tx) => {
    const d = new Date(tx.date);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  });

  // Calculate Monthly Metrics
  const monthlyIncome = currentMonthTransactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const monthlyExpenses = currentMonthTransactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const monthlyNet = monthlyIncome - monthlyExpenses;

  // Total Target Budget from all envelopes
  const totalTargetBudget = envelopes.reduce((sum, e) => sum + (e.targetAmount || 0), 0);

  // Bi-Weekly transfers list in this active month
  const biweeklyTransfers = currentMonthTransactions
    .filter((tx) => tx.type === 'income')
    .sort((a, b) => a.date - b.date);

  // Total Lifetime Balance in all envelopes
  const totalCurrentBalance = envelopes.reduce((sum, e) => sum + (e.currentBalance || 0), 0);

  // Filtered transactions for the History tab (ONLY real income & expenses)
  const historyTransactions = transactions.filter((tx) => {
    if (selectedEnvelopeId !== 'all' && tx.envelopeId !== selectedEnvelopeId) {
      return false;
    }
    if (!filterAllMonths) {
      const d = new Date(tx.date);
      if (d.getFullYear() !== selectedYear || d.getMonth() !== selectedMonth) {
        return false;
      }
    }
    return true;
  });

  // Handle transaction deletion (reversing balance adjustments)
  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!tx.id) return;
    
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus transaksi "${tx.description}" senilai Rp ${tx.amount.toLocaleString('id-ID')}? Tindakan ini akan mengembalikan saldo.`
    );
    if (!confirmDelete) return;

    try {
      if (tx.type === 'expense' && tx.envelopeId) {
        const env = await db.envelopes.get(tx.envelopeId);
        if (env) {
          const revertedBalance = env.currentBalance + tx.amount;
          await db.transaction('rw', [db.envelopes, db.transactions], async () => {
            await db.envelopes.update(tx.envelopeId!, { currentBalance: revertedBalance });
            await db.transactions.delete(tx.id!);
          });
        }
      } else if (tx.type === 'income') {
        const envs = await db.envelopes.toArray();
        await db.transaction('rw', [db.envelopes, db.transactions], async () => {
          if (tx.envelopeId) {
            const chosenEnv = await db.envelopes.get(tx.envelopeId);
            if (chosenEnv) {
              await db.envelopes.update(tx.envelopeId, {
                currentBalance: Math.max(0, chosenEnv.currentBalance - tx.amount),
              });
            }
          } else {
            // Proportionally deduct
            const totalTarget = envs.reduce((sum, e) => sum + (e.targetAmount || 0), 0);
            for (const env of envs) {
              const portion = totalTarget > 0 ? (env.targetAmount / totalTarget) : (1 / envs.length);
              const splitAmount = Math.round(tx.amount * portion);
              await db.envelopes.update(env.id, {
                currentBalance: Math.max(0, env.currentBalance - splitAmount),
              });
            }
          }
          await db.transactions.delete(tx.id!);
        });
      }
      
      await refreshAppData();
    } catch (err) {
      console.error('Error deleting transaction:', err);
      alert('Gagal menghapus transaksi.');
    }
  };

  // Reset application to start over
  const handleResetApp = async () => {
    const confirmReset = window.confirm(
      '⚠️ PERINGATAN: Tindakan ini akan MENGHAPUS SEMUA DATA transaksi, saldo, dan alokasi budget Anda secara permanen. Apakah Anda yakin?'
    );
    if (!confirmReset) return;

    try {
      await db.envelopes.clear();
      await db.transactions.clear();
      await db.settings.clear();
      await refreshAppData();
      setActiveTab('dashboard');
    } catch (err) {
      console.error('Error resetting app:', err);
      alert('Gagal melakukan reset.');
    }
  };

  // Re-run setup
  const handleReallocateBudget = async () => {
    try {
      await db.settings.put({ key: 'has_setup', value: false });
      await refreshAppData();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-500">Memuat SakuTracker...</p>
        </div>
      </div>
    );
  }

  // If no setup completed yet, show the setup wizard
  if (!hasSetup) {
    return <SetupDialog onSuccess={refreshAppData} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24 text-slate-900 dark:text-slate-100">
      
      {/* Centered Mobile Shell Layout */}
      <div className="max-w-md mx-auto min-h-screen bg-white dark:bg-slate-900 shadow-xl border-x border-slate-200 dark:border-slate-800 flex flex-col relative">
        
        {/* Header Bar - Clean */}
        <header className="sticky top-0 z-30 px-5 py-3.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm">
                <Wallet size={19} />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  SakuTracker
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                <Coins size={13} />
                Rp {totalCurrentBalance.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Month Selector Engine */}
          <div className="flex items-center justify-between p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 dark:hover:text-white transition-all shadow-sm"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-indigo-500" />
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </span>
              {isCurrentMonthActive ? (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-indigo-500 text-white uppercase tracking-wider">
                  Bulan Ini
                </span>
              ) : (
                <button
                  onClick={handleResetToCurrentMonth}
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-500 hover:text-white transition-all"
                >
                  Kembali ke Sekarang
                </button>
              )}
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white dark:hover:bg-slate-700 dark:hover:text-white transition-all shadow-sm"
              title="Bulan Berikutnya"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        {/* Tab Body Contents */}
        <main className="flex-1 px-4 py-4 overflow-y-auto">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              
              {/* Monthly Financial HUD Card */}
              <div className="relative p-6 rounded-3xl bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 text-white shadow-lg overflow-hidden">
                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10 text-white">
                  <Wallet size={160} />
                </div>
                
                <div className="space-y-4 relative">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Rekapitulasi: {MONTH_NAMES[selectedMonth]} {selectedYear}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          monthlyNet >= 0
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {monthlyNet >= 0 ? 'Surplus' : 'Defisit'}
                      </span>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight">
                      Sisa Bersih: Rp {monthlyNet.toLocaleString('id-ID')}
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Total Gajian Masuk</span>
                      <span className="font-extrabold text-emerald-400 flex items-center gap-0.5">
                        <ArrowUpRight size={14} />
                        Rp {monthlyIncome.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Pengeluaran ({MONTH_NAMES[selectedMonth]})</span>
                      <span className="font-extrabold text-rose-400 flex items-center gap-0.5">
                        <ArrowDownLeft size={14} />
                        Rp {monthlyExpenses.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Target vs Current Insight */}
                  <div className="pt-2 text-[10px] text-slate-300 border-t border-white/10 flex items-center justify-between">
                    <span>Total Target Anggaran Amplop:</span>
                    <span className="font-black text-amber-300">Rp {totalTargetBudget.toLocaleString('id-ID')}/bln</span>
                  </div>
                </div>
              </div>

              {/* Bi-Weekly Transfers Timeline Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CreditCard size={15} className="text-indigo-500" />
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Transfer 2-Mingguan Masuk ({MONTH_NAMES[selectedMonth]})
                    </h3>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {biweeklyTransfers.length}x Transfer
                  </span>
                </div>

                {biweeklyTransfers.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-1">
                    Belum ada transferan gajian yang dicatat di bulan ini.
                  </p>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    {biweeklyTransfers.map((tx, idx) => (
                      <div
                        key={tx.id || idx}
                        className="p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <BadgeCheck size={16} className="text-emerald-500 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                              {tx.description}
                            </span>
                            <span className="text-[9px] text-slate-400">
                              Cair Tgl {new Date(tx.date).getDate()} {MONTH_NAMES[selectedMonth]}
                            </span>
                          </div>
                        </div>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                          +Rp {tx.amount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions FAB bar */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setFormType('income');
                    setShowTransactionForm(true);
                  }}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all text-white font-bold rounded-2xl shadow-md shadow-emerald-500/10 text-xs"
                >
                  <Plus size={16} />
                  Transfer Gajian (2 Mg)
                </button>
                <button
                  onClick={() => {
                    setFormType('expense');
                    setShowTransactionForm(true);
                  }}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 bg-rose-500 hover:bg-rose-600 active:scale-[0.98] transition-all text-white font-bold rounded-2xl shadow-md shadow-rose-500/10 text-xs"
                >
                  <Plus size={16} />
                  Catat Belanja
                </button>
              </div>

              {/* Envelope Budgets Grid with Add & Edit Actions */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Pos Amplop Budget (Nominal Tetap)
                    </h3>
                  </div>

                  {/* Add New Envelope Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEnvelopeToEdit(null); // Mode Add
                      setShowEnvelopeModal(true);
                    }}
                    className="flex items-center gap-1 py-1 px-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-[11px] font-extrabold border border-indigo-200/60 dark:border-indigo-800/40 transition-all"
                  >
                    <FolderPlus size={13} />
                    Tambah Pos Baru
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {envelopes.map((env) => (
                    <BudgetEnvelope
                      key={env.id}
                      envelope={env}
                      onClick={() => {
                        setSelectedEnvelopeId(env.id);
                        setActiveTab('history');
                      }}
                      onEdit={(targetEnv) => {
                        setEnvelopeToEdit(targetEnv);
                        setShowEnvelopeModal(true);
                      }}
                    />
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: TRANSACTION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Riwayat Transaksi
                  </h3>
                  <button
                    onClick={() => setFilterAllMonths(!filterAllMonths)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                      filterAllMonths
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}
                  >
                    {filterAllMonths ? 'Semua Bulan Aktif' : `Filter: ${MONTH_NAMES[selectedMonth]}`}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {filterAllMonths
                    ? 'Menampilkan seluruh riwayat pengeluaran & transferan masuk.'
                    : `Menampilkan pengeluaran & transferan masuk bulan ${MONTH_NAMES[selectedMonth]} ${selectedYear}.`}
                </p>
              </div>

              {/* Envelope filter Pills */}
              <div className="flex gap-2 overflow-x-auto pb-1.5 -mx-4 px-4 scrollbar-thin">
                <button
                  onClick={() => setSelectedEnvelopeId('all')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all shrink-0 ${
                    selectedEnvelopeId === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  Semua Pos
                </button>
                {envelopes.map((env) => (
                  <button
                    key={env.id}
                    onClick={() => setSelectedEnvelopeId(env.id)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all shrink-0 border ${
                      selectedEnvelopeId === env.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {env.name}
                  </button>
                ))}
              </div>

              {/* Transactions Timeline */}
              <div className="space-y-2.5">
                {historyTransactions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 dark:text-slate-500 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <Info className="mx-auto" size={28} />
                    <p className="text-xs font-semibold">
                      Belum ada transaksi belanja atau transferan di bulan {MONTH_NAMES[selectedMonth]} {selectedYear}.
                    </p>
                  </div>
                ) : (
                  historyTransactions.map((tx) => {
                    const env = envelopes.find((e) => e.id === tx.envelopeId);
                    
                    return (
                      <div
                        key={tx.id}
                        className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3 shadow-sm hover:border-slate-200 dark:hover:border-slate-800 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              tx.type === 'income'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-rose-500/10 text-rose-500'
                            }`}
                          >
                            {tx.type === 'income' ? (
                              <ArrowUpRight size={16} />
                            ) : (
                              <ArrowDownLeft size={16} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate">
                              {tx.description}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {env && (
                                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wide">
                                  {env.name.split(' ')[0]}
                                </span>
                              )}
                              <span className="text-[9px] text-slate-400">
                                {new Date(tx.date).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className={`text-xs font-black ${
                              tx.type === 'income'
                                ? 'text-emerald-500'
                                : 'text-rose-500'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            Rp {tx.amount.toLocaleString('id-ID')}
                          </span>
                          
                          <button
                            onClick={() => handleDeleteTransaction(tx)}
                            className="p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                            title="Hapus Transaksi"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Pengaturan Aplikasi
              </h3>
              
              <div className="space-y-4">
                
                {/* Manage Envelopes directly in Settings */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                      <FolderPlus size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Kelola Pos Alokasi (Tambah / Edit Pos)
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tambah amplop baru (misal: ZIS, Kuota, Bensin, Rokok) atau sesuaikan nominal anggarannya.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEnvelopeToEdit(null);
                      setShowEnvelopeModal(true);
                    }}
                    className="w-full py-2 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                  >
                    + Tambah Pos Alokasi Baru
                  </button>
                </div>

                {/* Reallocate budget nominals */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Atur Ulang Target Anggaran Bulanan
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Sesuaikan ulang target nominal kebutuhan bulanan setiap amplop.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleReallocateBudget}
                    className="w-full py-2 px-4 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                  >
                    Atur Ulang Target Nominal
                  </button>
                </div>

                {/* Reset App */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 shrink-0">
                      <AlertCircle size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Reset Seluruh Data Aplikasi
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Menghapus semua riwayat transaksi, saldo, dan memulai setup dari awal.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleResetApp}
                    className="w-full py-2 px-4 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors"
                  >
                    Hapus & Reset Aplikasi
                  </button>
                </div>

                {/* Technical Info */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl flex gap-2.5 text-[11px] leading-relaxed text-slate-400">
                  <Info size={15} className="shrink-0 mt-0.5 text-indigo-500" />
                  <div>
                    <span className="font-semibold text-slate-500">SakuTracker V2.0 (Nominal Budget Edition)</span>
                    <br />
                    Tersimpan offline di memori browser. Bebas persentase, 100% nominal rupiah fleksibel.
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>

        {/* Bottom Tab Navigation Bar */}
        <nav className="absolute bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex justify-around py-3">
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === 'dashboard'
                ? 'text-indigo-600 dark:text-indigo-400 scale-105'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
            }`}
          >
            <Wallet size={20} />
            <span className="text-[10px] font-bold">Dompet</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === 'history'
                ? 'text-indigo-600 dark:text-indigo-400 scale-105'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
            }`}
          >
            <HistoryIcon size={20} />
            <span className="text-[10px] font-bold">Riwayat</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === 'settings'
                ? 'text-indigo-600 dark:text-indigo-400 scale-105'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
            }`}
          >
            <SettingsIcon size={20} />
            <span className="text-[10px] font-bold">Setelan</span>
          </button>

        </nav>

        {/* Transaction Input Overlay Modal */}
        {showTransactionForm && (
          <TransactionForm
            defaultType={formType}
            defaultDate={`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`}
            onClose={() => setShowTransactionForm(false)}
            onSuccess={refreshAppData}
          />
        )}

        {/* Envelope Add / Edit Modal */}
        {showEnvelopeModal && (
          <EnvelopeModal
            envelopeToEdit={envelopeToEdit}
            onClose={() => {
              setShowEnvelopeModal(false);
              setEnvelopeToEdit(null);
            }}
            onSuccess={refreshAppData}
          />
        )}

      </div>
    </div>
  );
}
