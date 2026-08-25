import Dexie, { type Table } from 'dexie';

export interface Envelope {
  id: string; // e.g., 'zis', 'kuota', 'bensin', 'rokok', 'jajan', 'belanja'
  name: string;
  allocatedPercentage: number; // Persentase alokasi, misal 10%
  targetAmount: number;        // Target nominal anggaran bulanan (e.g. 100.000, 200.000)
  currentBalance: number;      // Saldo sisa amplop saat ini (e.g. 125.000)
  color: string;               // Tailwind color name, e.g., 'emerald', 'indigo', 'amber', 'rose', 'cyan', 'blue', 'purple'
  icon: string;                // Lucide icon identifier
}

export interface Transaction {
  id?: number;
  envelopeId?: string;         // links to an envelope, undefined if general income
  type: 'income' | 'expense';  // ONLY real transactions (income & expense)
  amount: number;
  description: string;
  date: number;                // timestamp
}

export interface ProfileSetting {
  key: string;
  value: any;
}

export class SakuTrackerDatabase extends Dexie {
  envelopes!: Table<Envelope, string>;
  transactions!: Table<Transaction, number>;
  settings!: Table<ProfileSetting, string>;

  constructor() {
    super('SakuTrackerDatabase');
    this.version(3).stores({
      envelopes: 'id, name, allocatedPercentage, targetAmount',
      transactions: '++id, envelopeId, type, date',
      settings: 'key',
    });
  }
}

export const db = new SakuTrackerDatabase();

// Format number or string with Indonesian thousand separator dot (.)
export const formatRupiah = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '';
  const clean = val.toString().replace(/\D/g, '');
  if (!clean) return '';
  return parseInt(clean, 10).toLocaleString('id-ID');
};

// Parse formatted rupiah string back to raw number
export const parseRupiah = (formatted: string | number | undefined | null): number => {
  if (formatted === undefined || formatted === null || formatted === '') return 0;
  const clean = formatted.toString().replace(/\D/g, '');
  return clean ? parseInt(clean, 10) : 0;
};

// Prepopulate database with default envelopes if empty
export async function initializeDefaultData() {
  const envelopeCount = await db.envelopes.count();
  if (envelopeCount === 0) {
    const defaultEnvelopes: Envelope[] = [
      {
        id: 'zis',
        name: 'ZIS / Sedekah',
        allocatedPercentage: 2.5,
        targetAmount: 100000,
        currentBalance: 0,
        color: 'emerald',
        icon: 'Heart',
      },
      {
        id: 'kuota',
        name: 'Kuota & Pulsa',
        allocatedPercentage: 10.0,
        targetAmount: 100000,
        currentBalance: 0,
        color: 'cyan',
        icon: 'Smartphone',
      },
      {
        id: 'bensin',
        name: 'Bensin & Transportasi',
        allocatedPercentage: 10.0,
        targetAmount: 150000,
        currentBalance: 125000,
        color: 'blue',
        icon: 'Fuel',
      },
      {
        id: 'rokok',
        name: 'Rokok',
        allocatedPercentage: 12.5,
        targetAmount: 350000,
        currentBalance: 0,
        color: 'rose',
        icon: 'Flame',
      },
      {
        id: 'jajan',
        name: 'Jajan & Makan Harian',
        allocatedPercentage: 30.0,
        targetAmount: 500000,
        currentBalance: 0,
        color: 'amber',
        icon: 'Coffee',
      },
      {
        id: 'belanja',
        name: 'Belanja & Keperluan Pokok',
        allocatedPercentage: 20.0,
        targetAmount: 400000,
        currentBalance: 0,
        color: 'purple',
        icon: 'ShoppingBag',
      },
      {
        id: 'tabungan',
        name: 'Tabungan / Dana Darurat',
        allocatedPercentage: 15.0,
        targetAmount: 300000,
        currentBalance: 0,
        color: 'indigo',
        icon: 'PiggyBank',
      },
    ];

    await db.envelopes.bulkAdd(defaultEnvelopes);
    await db.settings.put({ key: 'monthly_income', value: 1250000 });
    await db.settings.put({ key: 'has_setup', value: false });
  }
}
