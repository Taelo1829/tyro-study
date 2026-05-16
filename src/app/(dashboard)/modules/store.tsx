// store/useCounter.ts
import { create } from "zustand";

type ModuleStore = {
    reload: boolean;
    toggleReload: () => void;
};

export const useModuleStore = create<ModuleStore>((set) => ({
    reload: false,
    toggleReload: () => set((state) => ({ reload: !state.reload })),
}));