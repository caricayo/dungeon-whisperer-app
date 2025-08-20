import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileOptimizedButtonProps extends ButtonProps {
  mobileSize?: 'sm' | 'default' | 'lg';
  fullWidthOnMobile?: boolean;
}

export const MobileOptimizedButton: React.FC<MobileOptimizedButtonProps> = ({
  className,
  mobileSize = 'default',
  fullWidthOnMobile = false,
  children,
  ...props
}) => {
  return (
    <Button
      {...props}
      className={cn(
        // Mobile-first responsive sizing
        "touch-manipulation", // Improves touch responsiveness
        "min-h-[44px]", // Apple's minimum touch target size
        "px-3 sm:px-4 md:px-6",
        
        // Mobile width handling
        fullWidthOnMobile && "w-full sm:w-auto",
        
        // Responsive text size
        mobileSize === 'sm' && "text-sm sm:text-base",
        mobileSize === 'lg' && "text-base sm:text-lg",
        
        // Prevent button overflow on small screens
        "max-w-full",
        "text-center",
        
        className
      )}
    >
      {children}
    </Button>
  );
};