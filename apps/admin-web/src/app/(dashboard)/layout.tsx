'use client';

import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { useCondominio } from '@/context/CondominioContext';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { theme } = useCondominio();

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: theme === 'dark' ? '#09090b' : '#f4f4f5',
        color: theme === 'dark' ? '#fafafa' : '#09090b',
      }}
    >
      <Sidebar />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme === 'dark' ? '#0c0c0e' : '#fafafa',
        }}
      >
        {children}
      </div>
    </div>
  );
}
