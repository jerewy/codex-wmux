import { StateCreator } from 'zustand';
import { OrchestrationState } from '../../shared/types';

export interface OrchestrationSlice {
  currentOrchestration: OrchestrationState | null;
  setOrchestration: (state: OrchestrationState) => void;
  clearOrchestration: () => void;
}

export const createOrchestrationSlice: StateCreator<OrchestrationSlice, [], [], OrchestrationSlice> = (set) => ({
  currentOrchestration: null,
  setOrchestration(state: OrchestrationState): void {
    set({ currentOrchestration: state });
  },
  clearOrchestration(): void {
    set({ currentOrchestration: null });
  },
});
