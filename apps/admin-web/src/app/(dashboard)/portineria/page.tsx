'use client';

import React, { useState } from 'react';
import { Package, CheckCircle2, Clock } from 'lucide-react';
import { useCondominio } from '@/context/CondominioContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function PortineriaPacchiPage() {
  const { activeCondominio } = useCondominio();
  const [pacchi, setPacchi] = useState([
    { id: 'pk-1', interno: 'Scala A • Int. 04', destinatario: 'Fam. Bernardi', corriere: 'Amazon Logistics', arrivo: 'Oggi, 09:15', stato: 'GIACENZA' },
    { id: 'pk-2', interno: 'Scala B • Int. 07', destinatario: 'Sig.ra Carla Monti', corriere: 'DHL Express', arrivo: 'Ieri, 15:40', stato: 'GIACENZA' },
    { id: 'pk-3', interno: 'Scala A • Int. 11', destinatario: 'Ing. Roberto Ferri', corriere: 'BRT Corriere', arrivo: '24 Ott 2026', stato: 'RITIRATO' },
  ]);

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          Portineria Digitale & Registro Pacchi — {activeCondominio.nome}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a1a1aa' }}>
          Sincronizzato in tempo reale con l’app mobile in modalità Portiere / Staff.
        </p>
      </div>

      <Card>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={16} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Giacenze in Guardiola</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #27272a', color: '#a1a1aa', fontSize: 11.5 }}>
              <th style={{ padding: '11px 20px' }}>Unità / Destinatario</th>
              <th style={{ padding: '11px 16px' }}>Corriere / Mittente</th>
              <th style={{ padding: '11px 16px' }}>Arrivo</th>
              <th style={{ padding: '11px 16px' }}>Stato</th>
              <th style={{ padding: '11px 20px', textAlign: 'right' }}>Azione</th>
            </tr>
          </thead>
          <tbody>
            {pacchi.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid rgba(39,39,42,0.6)' }}>
                <td style={{ padding: '13px 20px', fontWeight: 600 }}>
                  {p.destinatario} <span style={{ color: '#71717a', fontWeight: 400 }}>({p.interno})</span>
                </td>
                <td style={{ padding: '13px 16px' }}>{p.corriere}</td>
                <td style={{ padding: '13px 16px', color: '#a1a1aa' }}>{p.arrivo}</td>
                <td style={{ padding: '13px 16px' }}>
                  {p.stato === 'GIACENZA' ? (
                    <Badge variant="warning"><Clock size={12} /> In Giacenza</Badge>
                  ) : (
                    <Badge variant="success"><CheckCircle2 size={12} /> Ritirato</Badge>
                  )}
                </td>
                <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                  {p.stato === 'GIACENZA' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPacchi((prev) =>
                          prev.map((item) => (item.id === p.id ? { ...item, stato: 'RITIRATO' } : item))
                        )
                      }
                    >
                      Segna Ritirato
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
