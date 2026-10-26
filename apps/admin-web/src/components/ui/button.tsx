import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  style,
  children,
  ...props
}: ButtonProps) {
  const variantStyles: Record<NonNullable<ButtonProps['variant']>, React.CSSProperties> = {
    primary: {
      backgroundColor: '#fafafa',
      color: '#09090b',
      border: '1px solid #e4e4e7',
    },
    secondary: {
      backgroundColor: '#27272a',
      color: '#f4f4f5',
      border: '1px solid #3f3f46',
    },
    outline: {
      backgroundColor: 'transparent',
      color: '#e4e4e7',
      border: '1px solid #3f3f46',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#a1a1aa',
      border: '1px solid transparent',
    },
    danger: {
      backgroundColor: 'rgba(239, 68, 68, 0.16)',
      color: '#f87171',
      border: '1px solid rgba(239, 68, 68, 0.4)',
    },
  };

  const sizeStyles: Record<NonNullable<ButtonProps['size']>, React.CSSProperties> = {
    sm: { padding: '6px 10px', fontSize: 12, borderRadius: 6 },
    md: { padding: '8px 14px', fontSize: 13, borderRadius: 8 },
    lg: { padding: '10px 18px', fontSize: 14, borderRadius: 10 },
  };

  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 font-medium transition-colors', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontWeight: 500,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.55 : 1,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
