import type { ReactNode } from 'react';
import './globals.css';
import { CondominioProvider } from '@/context/CondominioContext';

export const metadata = {
  title: 'IoCondo Studio — Pannello Amministratore 2026',
  description: 'Piattaforma Gestionale Condominiale Enterprise Multi-Tenant con Riconciliazione AI',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" className="dark">
      <body
        style={{
          margin: 0,
          backgroundColor: '#09090b',
          color: '#fafafa',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        <CondominioProvider>{children}</CondominioProvider>
      </body>
    </html>
  );
}
