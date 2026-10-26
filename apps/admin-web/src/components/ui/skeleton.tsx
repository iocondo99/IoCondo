import React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-zinc-800/60', className)}
      style={{
        backgroundColor: 'rgba(113, 113, 122, 0.22)',
        borderRadius: 8,
        ...style,
      }}
      {...props}
    />
  );
}
