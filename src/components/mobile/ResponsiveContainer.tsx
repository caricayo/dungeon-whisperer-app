import React from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  mobileClass?: string;
  desktopClass?: string;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({ 
  children, 
  className = '',
  mobileClass = '',
  desktopClass = ''
}) => {
  return (
    <div className={cn(
      "w-full",
      // Base mobile-first styles
      "px-2 sm:px-4 md:px-6 lg:px-8",
      "space-y-3 sm:space-y-4 md:space-y-6",
      // Mobile overrides
      mobileClass,
      // Desktop overrides  
      desktopClass,
      className
    )}>
      {children}
    </div>
  );
};