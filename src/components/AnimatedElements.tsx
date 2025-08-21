import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  glowEffect?: boolean;
  hoverLift?: boolean;
  title?: string;
}

export function AnimatedButton({
  children,
  onClick,
  icon: Icon,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  glowEffect = false,
  hoverLift = true,
  title
}: AnimatedButtonProps) {
  const baseClasses = "relative inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses: Record<typeof variant, string> = {
    primary: "bg-gradient-primary text-primary-foreground hover:shadow-glow-lg border border-primary/20",
    secondary: "bg-gradient-mystical text-foreground hover:shadow-mystical border border-secondary/20",
    outline: "border-2 border-border bg-card/50 backdrop-blur-sm hover:bg-card text-foreground",
    ghost: "hover:bg-accent/10 text-foreground"
  };

  const sizeClasses: Record<typeof size, string> = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg"
  };

  const motionProps = {
    whileHover: hoverLift ? { 
      scale: 1.02, 
      y: -2,
      transition: { duration: 0.2 }
    } : { scale: 1.02 },
    whileTap: { 
      scale: 0.98,
      transition: { duration: 0.1 }
    }
  };

  return (
    <motion.button
      {...motionProps}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`
        ${baseClasses}
        ${variant === 'primary' ? variantClasses.primary : variant === 'secondary' ? variantClasses.secondary : variant === 'outline' ? variantClasses.outline : variantClasses.ghost}
        ${size === 'sm' ? sizeClasses.sm : size === 'md' ? sizeClasses.md : sizeClasses.lg}
        ${glowEffect ? 'glow-magical' : ''}
        ${className}
      `}
    >
      {/* Background shimmer effect */}
      {variant === 'primary' && (
        <div className="absolute inset-0 -translate-x-full -skew-x-12 animate-shimmer rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      )}

      {/* Loading spinner */}
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="size-4 rounded-full border-2 border-current border-t-transparent"
        />
      )}

      {/* Icon */}
      {Icon && !loading && (
        <motion.div
          whileHover={{ rotate: 12 }}
          transition={{ duration: 0.2 }}
        >
          <Icon className="size-5" />
        </motion.div>
      )}

      {/* Button text */}
      <span className="relative z-10">{children}</span>

      {/* Glow effect overlay */}
      {glowEffect && (
        <div className="absolute inset-0 rounded-xl bg-gradient-primary opacity-0 blur-sm transition-opacity duration-300 hover:opacity-20" />
      )}
    </motion.button>
  );
}

interface FloatingActionButtonProps {
  icon: LucideIcon;
  onClick: () => void;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  tooltip?: string;
  color?: 'primary' | 'secondary' | 'accent';
}

export function FloatingActionButton({
  icon: Icon,
  onClick,
  position = 'bottom-right',
  tooltip,
  color = 'primary'
}: FloatingActionButtonProps) {
  const positionClasses: Record<typeof position, string> = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6'
  };

  const colorClasses: Record<typeof color, string> = {
    primary: 'bg-gradient-primary text-primary-foreground shadow-glow',
    secondary: 'bg-gradient-mystical text-foreground shadow-mystical',
    accent: 'bg-accent text-accent-foreground shadow-elevated'
  };

  return (
    <motion.button
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      whileHover={{ 
        scale: 1.1, 
        rotate: 15,
        boxShadow: color === 'primary' ? '0 0 30px hsl(var(--primary) / 0.5)' : undefined
      }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`
        fixed z-50 flex size-14 items-center justify-center rounded-2xl backdrop-blur-sm
        transition-all duration-300 hover:shadow-2xl
        ${position === 'bottom-right' ? positionClasses['bottom-right'] : position === 'bottom-left' ? positionClasses['bottom-left'] : position === 'top-right' ? positionClasses['top-right'] : positionClasses['top-left']}
        ${color === 'primary' ? colorClasses.primary : color === 'secondary' ? colorClasses.secondary : colorClasses.accent}
      `}
      title={tooltip}
    >
      <Icon className="size-6" />
      
      {/* Pulse ring effect */}
      <motion.div
        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className={`absolute inset-0 rounded-2xl border-2 ${
          color === 'primary' ? 'border-primary' : 
          color === 'secondary' ? 'border-secondary' : 'border-accent'
        }`}
      />
    </motion.button>
  );
}

interface InteractiveCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  hoverEffect?: 'lift' | 'glow' | 'scale' | 'none';
  glowColor?: 'primary' | 'secondary' | 'accent';
}

export function InteractiveCard({
  children,
  onClick,
  className = '',
  hoverEffect = 'lift',
  glowColor = 'primary'
}: InteractiveCardProps) {
  const hoverEffects: Record<typeof hoverEffect, object> = {
    lift: { y: -8, transition: { duration: 0.3 } },
    glow: { boxShadow: `0 0 30px hsl(var(--${glowColor}) / 0.3)` },
    scale: { scale: 1.03 },
    none: {}
  };

  return (
    <motion.div
      whileHover={hoverEffect === 'lift' ? hoverEffects.lift : hoverEffect === 'glow' ? hoverEffects.glow : hoverEffect === 'scale' ? hoverEffects.scale : hoverEffects.none}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        cursor-pointer rounded-2xl border border-border bg-card backdrop-blur-sm
        transition-all duration-300 hover:border-primary/50 hover:shadow-elevated
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}