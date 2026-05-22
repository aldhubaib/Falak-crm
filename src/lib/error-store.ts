import { create } from "zustand";
import { type AppError } from "./errors";

interface ErrorStore {
  errors: AppError[];
  push: (error: AppError) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useErrorStore = create<ErrorStore>((set) => ({
  errors: [],
  push: (error) =>
    set((state) => ({ errors: [error, ...state.errors].slice(0, 20) })),
  dismiss: (id) =>
    set((state) => ({ errors: state.errors.filter((e) => e.id !== id) })),
  clear: () => set({ errors: [] }),
}));
