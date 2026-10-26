import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline';
}

export function Badge({
  className,
  variant = 'default',
  style,
  children,
  ...props
}: BadgeProps) {
  const variantStyles: Record<NonNullable<BadgeProps['variant']>, React.CSSProperties> = {
    default: {
      backgroundColor: 'rgba(63, 63, 70, 0.45)',
      color: '#e4e4e7',
      border: '1px solid rgba(82, 82, 91, 0.6)',
    },
    success: {
      backgroundColor: 'rgba(16, 185, 129, 0.14)',
      color: '#34d399',
      border: '1px solid rgba(16, 185, 129, 0.35)',
    },
    warning: {
      backgroundColor: 'rgba(245, 158, 11, 0.14)',
      color: '#fbbf24',
      border: '1px solid rgba(245, 158, 11, 0.35)',
    },
    danger: {
      backgroundColor: 'rgba(239, 68, 68, 0.14)',
      color: '#f87171',
      border: '1px solid rgba(239, 68, 68, 0.35)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: '#a1a1aa',
      border: '1px solid rgba(82, 82, 91, 0.6)',
    },
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        className
      )}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 9999,
        padding: '3px 10px',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.01em',
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
