import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Company, companyRepo } from '../db';

interface Toast {
  message: string;
  isError: boolean;
  undoKey?: string;
  onUndo?: () => void;
}

interface AppStore {
  currentCompanyId: number;
  currentCompanyName: string;
  viewAllCompanies: boolean;
  setCurrentCompany: (id: number, name: string) => void;
  setViewAllCompanies: (v: boolean) => void;

  companies: Company[];
  loadCompanies: () => void;

  toast: Toast | null;
  showToast: (msg: string, opts?: { isError?: boolean; onUndo?: () => void }) => void;
  hideToast: () => void;

  searchQuery: string;
  setSearchQuery: (q: string) => void;

  openModal: string | null;
  setOpenModal: (name: string | null) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentCompanyId:   1,
  currentCompanyName: '',
  viewAllCompanies:   true,
  companies:          [],

  loadCompanies: () => {
    set({ companies: companyRepo.getAll() });
  },

  setCurrentCompany: async (id, name) => {
    set({ currentCompanyId: id, currentCompanyName: name });
    await SecureStore.setItemAsync('current_company_id', String(id));
    await SecureStore.setItemAsync('current_company_name', name);
  },

  setViewAllCompanies: (v) => set({ viewAllCompanies: v }),

  toast: null,
  showToast: (message, opts = {}) => {
    set({ toast: { message, isError: opts.isError ?? false, onUndo: opts.onUndo } });
    const timeout = opts.onUndo ? 3500 : 2500;
    setTimeout(() => {
      if (get().toast?.message === message) set({ toast: null });
    }, timeout);
  },
  hideToast: () => set({ toast: null }),

  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  openModal: null,
  setOpenModal: (name) => set({ openModal: name }),
}));

export async function loadSavedCompany(): Promise<{ id: number; name: string } | null> {
  try {
    const id   = await SecureStore.getItemAsync('current_company_id');
    const name = await SecureStore.getItemAsync('current_company_name');
    if (id && name) return { id: parseInt(id), name };
  } catch {}
  return null;
}
