'use client';

import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { useCondominio } from '@/context/CondominioContext';
import { Card } from '@/components/ui/card';
import { services } from '@/services';
import type { FeatureToggles } from '@/services';

export default function ImpostazioniStudioPage() {
  const { activeCondominio } = useCondominio();
  const [toggles, setToggles] = useState<FeatureToggles>({
    abilita_social: true,
    abilita_chat: true,
    abilita_bacheca: true,
    abilita_ticket: true,
    abilita_prenotazioni: true,
    abilita_pacchi: true,
  });

  const handleToggle = async (key: keyof FeatureToggles) => {
    const next = { ...toggles, [key]: !toggles[key] };
    setToggles(next);
    await services.condomini.setFeatureToggles(activeCondominio.id, null, next).catch(() => null);
  };

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          Impostazioni Studio & Feature Toggle Condominio (UC-05)
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a1a1aa' }}>
          Attiva o disattiva in tempo reale i moduli visibili nell’app mobile per <strong>{activeCondominio.nome}</strong>.
        </p>
      </div>

      <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Settings size={16} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Moduli Abilitati sul Condominio</span>
        </div>

        {(Object.keys(toggles) as Array<keyof FeatureToggles>).map((key) => (
          <label
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 8,
              backgroundColor: '#09090b',
              border: '1px solid #27272a',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 500, fontFamily: 'monospace' }}>{key}</span>
            <input
              type="checkbox"
              checked={toggles[key]}
              onChange={() => handleToggle(key)}
              style={{ width: 18, height: 18, accentColor: '#10b981' }}
            />
          </label>
        ))}
      </Card>
    </div>
  );
}
