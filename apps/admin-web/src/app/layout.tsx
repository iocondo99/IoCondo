import type { ReactNode } from 'react';

export const metadata = { title: 'IoCondo Admin', description: 'Gestionale amministratore condominiale' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
