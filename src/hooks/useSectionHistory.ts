import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface SectionHistoryEntry {
  path: string;
  timestamp: number;
}

export const useSectionHistory = (sectionKey: string) => {
  const navigate = useNavigate();
  const storageKey = `sectionHistory_${sectionKey}`;

  // Get section history from sessionStorage
  const getHistory = useCallback((): SectionHistoryEntry[] => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, [storageKey]);

  // Set section history to sessionStorage
  const setHistory = useCallback((history: SectionHistoryEntry[]) => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(history));
    } catch {
      // Silently fail if storage is not available
    }
  }, [storageKey]);

  // Push a path to section history
  const push = useCallback((path: string) => {
    const history = getHistory();
    const entry: SectionHistoryEntry = { path, timestamp: Date.now() };
    
    console.log(`🔄 Pushing to section history (${sectionKey}):`, entry);
    
    // Remove duplicates and add new entry
    const filtered = history.filter(item => item.path !== path);
    const newHistory = [...filtered, entry].slice(-10); // Keep last 10 entries
    
    setHistory(newHistory);
    console.log(`🔄 Section history updated:`, newHistory);
  }, [getHistory, setHistory, sectionKey]);

  // Navigate back within section or to fallback
  const back = useCallback((fallbackPath: string): boolean => {
    const history = getHistory();
    
    console.log(`🔄 Section back requested for ${sectionKey}:`, { history, fallbackPath });
    
    if (history.length > 1) {
      // Remove current path and go to previous
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      const prevPath = newHistory[newHistory.length - 1]?.path;
      
      console.log(`🔄 Going back to previous path:`, prevPath);
      if (prevPath && prevPath !== window.location.pathname) {
        navigate(prevPath);
        return true;
      }
    }
    
    // No history or fallback case - go to section root
    console.log(`🔄 No section history, going to fallback:`, fallbackPath);
    navigate(fallbackPath);
    return false;
  }, [getHistory, setHistory, navigate]);

  // Clear section history
  const clear = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  return { push, back, clear };
};