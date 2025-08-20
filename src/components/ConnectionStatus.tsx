import React, { useState, useEffect } from 'react';
import { debugLog } from '@/lib/debug';

export const ConnectionStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const handleOnline = (): void => {
      debugLog('Connection restored');
      setIsOnline(true);
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 3000);
    };

    const handleOffline = (): void => {
      debugLog('Connection lost');
      setIsOnline(false);
      setShowAlert(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showAlert && isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className={`rounded-lg p-3 shadow-lg ${isOnline ? 'bg-green-500' : 'bg-red-500'} text-white`}>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-white"></div>
          <span className="text-sm">
            {isOnline ? 'Connection restored' : 'No internet connection'}
          </span>
        </div>
      </div>
    </div>
  );
};