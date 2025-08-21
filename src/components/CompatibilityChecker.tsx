import React, { useEffect, useState, ReactNode } from 'react';
import { CompatibilityContext } from '@/hooks/use-compatibility';

interface CompatibilityState {
  isCompatible: boolean;
  issues: string[];
  warnings: string[];
}

interface CompatibilityProviderProps {
  children: ReactNode;
}

export const CompatibilityProvider: React.FC<CompatibilityProviderProps> = ({ children }) => {
  const [compatibility, setCompatibility] = useState<CompatibilityState>({
    isCompatible: true,
    issues: [],
    warnings: [],
  });

  useEffect(() => {
    const checkCompatibility = (): void => {
      const issues: string[] = [];
      const warnings: string[] = [];

      // Check for critical features
      if (!('fetch' in window)) {
        issues.push('Fetch API not supported');
      }
      
      if (!('WebSocket' in window)) {
        issues.push('WebSocket not supported');
      }
      
      if (!('localStorage' in window)) {
        issues.push('Local Storage not supported');
      }

      if (!('sessionStorage' in window)) {
        issues.push('Session Storage not supported');
      }

      setCompatibility({
        isCompatible: issues.length === 0,
        issues,
        warnings,
      });
    };

    checkCompatibility();
  }, []);

  if (!compatibility.isCompatible) {
    return (<div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold text-destructive">Browser Not Compatible</h1>
          <div className="space-y-2">
            <p className="text-muted-foreground">Your browser doesn't support all required features:</p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {compatibility.issues.map((issue, _index) => (
                <li key={_index}>{issue}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm">
              Please update your browser or use a modern browser like Chrome, Firefox, or Safari.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CompatibilityContext.Provider value={compatibility}>
      {children}
    </CompatibilityContext.Provider>
  );
};