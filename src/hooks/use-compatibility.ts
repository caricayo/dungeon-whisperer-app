import { createContext, useContext } from 'react';

interface CompatibilityState {
  isCompatible: boolean;
  issues: string[];
  warnings: string[];
}

export const CompatibilityContext = createContext<CompatibilityState>({
  isCompatible: true,
  issues: [],
  warnings: [],
});

export const useCompatibility = (): CompatibilityState => useContext(CompatibilityContext);
