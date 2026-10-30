import type { ReactNode } from 'react';
import { CondominioProvider } from '@/context/CondominioContext';

export const metadata = {
  title: 'IoCondo Studio — Pannello Amministratore 2026',
  description: 'Piattaforma Gestionale Condominiale Enterprise Multi-Tenant con Riconciliazione AI',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>
        <CondominioProvider>{children}</CondominioProvider>
      </body>
    </html>
  );
}
