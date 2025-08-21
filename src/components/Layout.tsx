import React from 'react';
import { UsernameSetupModal } from '@/components/UsernameSetupModal';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { useUserProfile } from '@/hooks/use-user-profile';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { needsUsername } = useUserProfile();
  
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
      
      {/* Connection Status Monitor */}
      <ConnectionStatus />
      
      {/* Global Username Setup Modal - Only show when actually needed */}
      <UsernameSetupModal isOpen={needsUsername} />
    </div>
  );
};