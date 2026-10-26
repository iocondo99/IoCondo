import React from 'react';
import { cn } from '@/lib/utils';

export function Card({
  className,
  style,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-zinc-800 bg-zinc-900/70 text-zinc-100', className)}
      style={{
        borderRadius: 12,
        border: '1px solid rgba(63, 63, 70, 0.7)',
        backgroundColor: 'rgba(24, 24, 27, 0.85)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
