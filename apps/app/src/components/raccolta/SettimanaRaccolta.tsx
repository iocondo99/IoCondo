import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { IRaccoltaDifferenziata } from '@iocondo/shared-types';
import { GIORNI_SETTIMANA, metadatiTipoRifiuto, type CategoriaRifiuto, type GiornoSettimana } from '@iocondo/data';
import { Icon, colors, radii, space, textStyle, useBreakpoint } from '@iocondo/ui';

/**
 * Colori dei contenitori, come li si riconosce sotto casa. Sfondo tenue e testo scuro
 * (contrasto >= 4,5:1); la striscia a sinistra porta il colore pieno del bidone.
 */
export const COLORI_BIDONE: Record<CategoriaRifiuto, { pieno: string; sfondo: string; testo: string }> = {
  organico: { pieno: '#7A4E2D', sfondo: '#F3EAE2', testo: '#4A2E19' },
  carta: { pieno: '#1D5FA8', sfondo: '#E6EEF8', testo: '#163F6E' },
  plastica: { pieno: '#D4A20A', sfondo: '#FBF3D6', testo: '#5C4600' },
  vetro: { pieno: '#2F7D3A', sfondo: '#E5F2E7', testo: '#1E4F25' },
  sfalci: { pieno: '#5E8C2A', sfondo: '#EEF5E3', testo: '#3A5A16' },
  indifferenziato: { pieno: '#5B6470', sfondo: '#ECEEF1', testo: '#343B44' },
  altro: { pieno: '#7B6AA8', sfondo: '#EFECF6', testo: '#463A6E' },
};

export function coloreBidone(tipo: string) {
  return COLORI_BIDONE[metadatiTipoRifiuto(tipo).categoria];
}

/**
 * I sette giorni della settimana. `daOggi`: si parte da oggi; altrimenti da lunedì a domenica.
 * In entrambi i casi oggi e domani restano segnalati.
 */
export function settimanaDaOggi(oggi: GiornoSettimana, daOggi = true) {
  const domani = ((oggi % 7) + 1) as GiornoSettimana;
  return Array.from({ length: 7 }, (_, i) => {
    const numero = (daOggi ? ((oggi - 1 + i) % 7) + 1 : i + 1) as GiornoSettimana;
    const info = GIORNI_SETTIMANA.find((g) => g.numero === numero)!;
    return { ...info, relativo: numero === oggi ? 'Oggi' : numero === domani ? 'Domani' : null };
  });
}

/** Un bidone: colore, nome e nota di esposizione. */
export function Bidone({
  turno,
  grande = false,
  onPress,
}: {
  turno: IRaccoltaDifferenziata;
  grande?: boolean;
  onPress?: () => void;
}) {
  const { breakpoint } = useBreakpoint();
  const c = coloreBidone(turno.tipo_rifiuto);
  const meta = metadatiTipoRifiuto(turno.tipo_rifiuto);
  const contenuto = (
    <>
      <View style={styles.bidoneTesta}>
        <Icon name={meta.icona} size={grande ? 'action' : 'indicator'} color={c.testo} />
        <Text style={[textStyle(grande ? 'h4' : 'label', breakpoint), styles.bidoneNome, { color: c.testo }]}>
          {turno.tipo_rifiuto}
        </Text>
      </View>
      {turno.note?.trim() ? (
        <Text style={[textStyle(grande ? 'body' : 'support', breakpoint), { color: c.testo }]}>{turno.note}</Text>
      ) : null}
    </>
  );
  const stile = [styles.bidone, grande && styles.bidoneGrande, { backgroundColor: c.sfondo, borderLeftColor: c.pieno }];
  if (!onPress) return <View style={stile}>{contenuto}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${turno.tipo_rifiuto}${turno.note ? `. ${turno.note}` : ''}`}
      accessibilityHint="Apre il turno per modificarlo o eliminarlo"
      onPress={onPress}
      style={({ focused }: { focused?: boolean }) => [...stile, styles.premibile, focused && styles.focus]}
    >
      {contenuto}
    </Pressable>
  );
}

/**
 * La settimana da oggi in avanti: una colonna per giorno su desktop, una riga per giorno su
 * smartphone. Con `onAggiungi` (amministratore) ogni giorno ha il suo "Aggiungi".
 */
export function SettimanaRaccolta({
  turni,
  oggi,
  onPressTurno,
  onAggiungi,
  daLunedi = false,
}: {
  turni: readonly IRaccoltaDifferenziata[];
  oggi: GiornoSettimana;
  /** Settimana fissa da lunedì a domenica invece che a partire da oggi. */
  daLunedi?: boolean;
  onPressTurno?: (t: IRaccoltaDifferenziata) => void;
  onAggiungi?: (giorno: GiornoSettimana) => void;
}) {
  const { breakpoint, isDesktop } = useBreakpoint();
  const giorni = settimanaDaOggi(oggi, !daLunedi);
  return (
    <View style={[styles.settimana, isDesktop && styles.settimanaDesktop]}>
      {giorni.map((g) => {
        const delGiorno = turni.filter((t) => t.giorno_settimana === g.numero);
        return (
          <View
            key={g.numero}
            style={[styles.giorno, isDesktop && styles.giornoDesktop, g.relativo === 'Oggi' && styles.giornoOggi]}
          >
            <View style={[styles.giornoTesta, !isDesktop && styles.giornoTestaRiga]}>
              <Text accessibilityRole="header" aria-level={3} style={[textStyle('h4', breakpoint), styles.giornoNome]}>
                {isDesktop ? g.breve : g.nome}
              </Text>
              {g.relativo ? (
                <Text style={[textStyle('support', breakpoint), styles.giornoRelativo]}>{g.relativo}</Text>
              ) : null}
            </View>
            <View style={styles.giornoBidoni}>
              {delGiorno.length === 0 ? (
                <Text style={[textStyle('support', breakpoint), styles.nessuno]}>Nessun ritiro</Text>
              ) : (
                delGiorno.map((t) => (
                  <Bidone key={t.id} turno={t} onPress={onPressTurno ? () => onPressTurno(t) : undefined} />
                ))
              )}
              {onAggiungi ? <Aggiungi nomeGiorno={g.nome} onPress={() => onAggiungi(g.numero)} /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Aggiungi({ nomeGiorno, onPress }: { nomeGiorno: string; onPress: () => void }) {
  const { breakpoint } = useBreakpoint();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Aggiungi un ritiro di ${nomeGiorno.toLowerCase()}`}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({ focused }: { focused?: boolean }) => [styles.aggiungi, styles.premibile, hover && styles.aggiungiHover, focused && styles.focus]}
    >
      <Icon name="plus" size="indicator" color={colors.action.default} />
      <Text style={[textStyle('support', breakpoint), styles.aggiungiTesto]}>Aggiungi</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  settimana: { gap: 0, borderTopWidth: 1, borderTopColor: colors.border },
  settimanaDesktop: { flexDirection: 'row', borderTopWidth: 0, gap: space[2] },
  giorno: { flexDirection: 'row', gap: space[4], paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: colors.border },
  giornoDesktop: { flex: 1, minWidth: 0, flexDirection: 'column', gap: space[2], borderBottomWidth: 0, paddingVertical: 0 },
  giornoOggi: {},
  giornoTesta: { gap: 0 },
  giornoTestaRiga: { width: 96, paddingTop: space[1] },
  giornoNome: { color: colors.brand.navy },
  giornoRelativo: { color: colors.text.secondary },
  giornoBidoni: { flex: 1, minWidth: 0, gap: space[2] },
  nessuno: { color: colors.text.muted, paddingVertical: space[2] },
  bidone: { alignSelf: 'stretch', minWidth: 0, borderLeftWidth: 4, borderRadius: radii.control, paddingVertical: space[2], paddingHorizontal: space[3], gap: 2 },
  bidoneGrande: { borderLeftWidth: 6, paddingVertical: space[3], paddingHorizontal: space[4], gap: space[1] },
  bidoneTesta: { flexDirection: 'row', alignItems: 'center', gap: space[2], minWidth: 0 },
  // Nelle colonne strette i nomi lunghi (es. Indifferenziata) vanno a capo invece di uscire dal riquadro.
  bidoneNome: { flexShrink: 1, minWidth: 0, ...({ overflowWrap: 'break-word', wordBreak: 'break-word' } as object) },
  premibile: Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {},
  focus: Platform.OS === 'web'
    ? ({ outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.focus, outlineOffset: 2 } as object)
    : { borderColor: colors.focus, borderWidth: 2 },
  aggiungi: { flexDirection: 'row', alignItems: 'center', gap: space[1], paddingVertical: space[2], paddingHorizontal: space[2], borderRadius: radii.control, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong },
  aggiungiHover: { backgroundColor: colors.background },
  aggiungiTesto: { color: colors.action.default },
});
