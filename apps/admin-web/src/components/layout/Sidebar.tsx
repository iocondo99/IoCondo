'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Wallet,
  Wrench,
  Package,
  Users,
  FolderLock,
  Settings,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { useCondominio } from '@/context/CondominioContext';

export interface NavItem {
  label: string;
  href: string;
  icon: React.FC<{ size?: number | string; strokeWidth?: number | string; className?: string }>;
  badge?: string;
}

export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  { label: 'Panoramica / Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Stabili & Unità', href: '/stabili', icon: Building2 },
  { label: 'Contabilità & Rate', href: '/contabilita', icon: Wallet, badge: 'AI' },
  { label: 'Ticket & Guasti', href: '/ticket', icon: Wrench, badge: '4' },
  { label: 'Portineria & Pacchi', href: '/portineria', icon: Package },
  { label: 'Assemblee', href: '/assemblee', icon: Users },
  { label: 'Documenti & RLS', href: '/documenti', icon: FolderLock },
  { label: 'Impostazioni Studio', href: '/impostazioni', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const {
    condomini,
    activeCondominio,
    setActiveCondominioId,
    theme,
    toggleTheme,
    sidebarCollapsed,
    setSidebarCollapsed,
    commandPaletteOpen,
    setCommandPaletteOpen,
  } = useCondominio();

  const [searchQuery, setSearchQuery] = useState('');

  const filteredCondomini = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return condomini;
    return condomini.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.codice_fiscale ?? '').toLowerCase().includes(q) ||
        (c.indirizzo ?? '').toLowerCase().includes(q)
    );
  }, [condomini, searchQuery]);

  const width = sidebarCollapsed ? 72 : 276;

  return (
    <>
      <aside
        className="h-screen bg-zinc-950 text-zinc-200 flex flex-col justify-between border-r border-zinc-800/80 select-none shrink-0"
        style={{
          width,
          minWidth: width,
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
          backgroundColor: '#09090b',
          color: '#e4e4e7',
          borderRight: '1px solid #27272a',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'width 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 30,
        }}
      >
        {/* TOP: Brand + Selettore Condominio Cmd+K */}
        <div style={{ padding: sidebarCollapsed ? '14px 10px' : '16px 14px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'space-between',
              marginBottom: 14,
            }}
          >
            {!sidebarCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: 'linear-gradient(135deg, #fafafa 0%, #a1a1aa 100%)',
                    color: '#09090b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 13,
                    letterSpacing: '-0.03em',
                  }}
                >
                  IC
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em' }}>
                    IoCondo <span style={{ color: '#71717a', fontWeight: 500 }}>Studio</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.04em' }}>
                    ENTERPRISE 2026
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              title={sidebarCollapsed ? 'Espandi sidebar' : 'Riduci sidebar a icone'}
              style={{
                background: 'transparent',
                border: '1px solid #27272a',
                color: '#a1a1aa',
                borderRadius: 7,
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
          </div>

          {/* Condominio Switcher Button (Cmd+K / Ctrl+K) */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            title="Cambia condominio attivo (Cmd+K / Ctrl+K)"
            style={{
              width: '100%',
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: 9,
              padding: sidebarCollapsed ? '9px 0' : '9px 11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'space-between',
              color: '#f4f4f5',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, overflow: 'hidden' }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Building2 size={14} strokeWidth={1.5} />
              </div>
              {!sidebarCollapsed && (
                <div style={{ overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: '#fafafa',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {activeCondominio.nome}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#71717a', fontFamily: 'monospace' }}>
                    CF {activeCondominio.codice_fiscale}
                  </div>
                </div>
              )}
            </div>

            {!sidebarCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <kbd
                  style={{
                    fontSize: 10,
                    padding: '2px 5px',
                    borderRadius: 4,
                    backgroundColor: '#09090b',
                    border: '1px solid #27272a',
                    color: '#a1a1aa',
                    fontFamily: 'monospace',
                  }}
                >
                  ⌘K
                </kbd>
                <ChevronsUpDown size={13} strokeWidth={1.5} />
              </div>
            )}
          </button>
        </div>

        {/* NAVIGATION ITEMS */}
        <nav
          aria-label="Menu Amministratore"
          style={{
            flex: 1,
            padding: sidebarCollapsed ? '6px 10px' : '6px 12px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {!sidebarCollapsed && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: '#71717a',
                padding: '6px 8px 4px',
                textTransform: 'uppercase',
              }}
            >
              Gestione Condominiale
            </div>
          )}

          {SIDEBAR_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={sidebarCollapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarCollapsed ? 'center' : 'space-between',
                  padding: sidebarCollapsed ? '10px 0' : '9px 11px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 450,
                  color: isActive ? '#fafafa' : '#a1a1aa',
                  backgroundColor: isActive ? '#18181b' : 'transparent',
                  border: isActive ? '1px solid #27272a' : '1px solid transparent',
                  transition: 'all 120ms ease',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon
                    size={17}
                    strokeWidth={1.5}
                    className={isActive ? 'text-emerald-400' : 'text-zinc-400'}
                  />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </span>

                {!sidebarCollapsed && item.badge && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '1px 7px',
                      borderRadius: 9999,
                      backgroundColor:
                        item.badge === 'AI'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(245, 158, 11, 0.16)',
                      color: item.badge === 'AI' ? '#34d399' : '#fbbf24',
                      border:
                        item.badge === 'AI'
                          ? '1px solid rgba(16, 185, 129, 0.35)'
                          : '1px solid rgba(245, 158, 11, 0.35)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* BOTTOM: Profilo Amministratore Compatto & Toggle Dark/Light Mode */}
        <div
          style={{
            padding: sidebarCollapsed ? '12px 10px' : '12px 14px',
            borderTop: '1px solid #27272a',
            backgroundColor: '#09090b',
            display: 'flex',
            flexDirection: sidebarCollapsed ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, overflow: 'hidden' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                color: '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              MR
            </div>
            {!sidebarCollapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#f4f4f5',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Dott. Marco Rossi
                </div>
                <div style={{ fontSize: 11, color: '#71717a' }}>Amministratore Senior</div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Passa a modalità chiara' : 'Passa a modalità scura'}
            aria-label="Cambia tema"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              color: '#e4e4e7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {theme === 'dark' ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
          </button>
        </div>
      </aside>

      {/* Command Palette Modal (Cmd+K / Ctrl+K) per cambio rapido condominio */}
      {commandPaletteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Selettore rapido condominio"
          onClick={() => setCommandPaletteOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(9, 9, 11, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '12vh',
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              backgroundColor: '#09090b',
              border: '1px solid #27272a',
              borderRadius: 12,
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderBottom: '1px solid #27272a',
              }}
            >
              <Search size={16} strokeWidth={1.5} />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca condominio per nome, codice fiscale o indirizzo..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fafafa',
                  fontSize: 13.5,
                }}
              />
              <kbd
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 4,
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  color: '#a1a1aa',
                }}
              >
                ESC
              </kbd>
            </div>

            <div style={{ maxHeight: 320, overflowY: 'auto', padding: 8 }}>
              {filteredCondomini.map((cond) => {
                const isSelected = cond.id === activeCondominio.id;
                return (
                  <button
                    key={cond.id}
                    type="button"
                    onClick={() => {
                      setActiveCondominioId(cond.id);
                      setCommandPaletteOpen(false);
                      setSearchQuery('');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: isSelected ? '#18181b' : 'transparent',
                      color: '#f4f4f5',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{cond.nome}</div>
                      <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 2 }}>
                        CF: {cond.codice_fiscale} • {cond.indirizzo ?? 'Indirizzo registrato'}
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 size={16} strokeWidth={1.5} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
