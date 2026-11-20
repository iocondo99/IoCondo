import React, { useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Icon, focusRing, space, textStyle, useBreakpoint, type IconName } from '@iocondo/ui';
import { BrandMark } from '@/components/Brand';

/*
 * Landing di IoCondo. Idea guida: la pulsantiera del citofono, l'oggetto che ogni condominio
 * italiano ha all'ingresso. Ogni "campanello" è un servizio: premendolo, il display mostra cosa fa.
 * Il resto della pagina è quieto: testo, colonne, niente schede decorative.
 */

const P = {
  intonaco: '#E9EDE9', // muro dell'androne, freddo e chiaro
  inchiostro: '#0D3B66', // navy del marchio
  ottone: '#A8873A', // placca del citofono
  ottoneScuro: '#6E5622',
  display: '#16302B', // display verde scuro del citofono
  displayTesto: '#CFE8DA',
  testo: '#1F2A37',
  testoTenue: '#4B5563',
  bianco: '#FFFFFF',
} as const;

interface Campanello {
  chiave: string;
  icona: IconName;
  nome: string;
  display: string;
}

const CAMPANELLI: Campanello[] = [
  { chiave: 'rate', icona: 'coins', nome: 'Rate e spese', display: 'Quanto devi, entro quando, e come è stata divisa la spesa.' },
  { chiave: 'avvisi', icona: 'bell', nome: 'Avvisi', display: 'Le comunicazioni dell’amministratore arrivano a te, non sulla bacheca dell’ascensore.' },
  { chiave: 'guasti', icona: 'wrench', nome: 'Guasti', display: 'Segnali il guasto con una foto e segui l’intervento fino alla chiusura.' },
  { chiave: 'spazi', icona: 'calendar-days', nome: 'Spazi comuni', display: 'Prenoti la sala o la lavanderia senza accavallarti con il vicino.' },
  { chiave: 'raccolta', icona: 'recycle', nome: 'Raccolta', display: 'Stasera quale bidone si espone? Lo vedi a colpo d’occhio.' },
  { chiave: 'assemblee', icona: 'file-text', nome: 'Assemblee', display: 'Convocazioni, presenze, voti e verbali nello stesso posto.' },
];

const RUOLI = [
  {
    titolo: 'Chi abita',
    testo: 'Controlli rate e scadenze, leggi gli avvisi, segnali un guasto, prenoti uno spazio.',
  },
  {
    titolo: 'Chi custodisce',
    testo: 'Registri pacchi e consegne, avvisi il residente all’arrivo, annoti le anomalie del giro.',
  },
  {
    titolo: 'Chi amministra',
    testo: 'Tieni la contabilità, convochi e gestisci le assemblee, scrivi a tutti i condòmini in un passaggio.',
  },
] as const;

export function LandingScreen() {
  const router = useRouter();
  const { breakpoint, isDesktop, isMobile } = useBreakpoint();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const posizioni = useRef<Record<string, number>>({});
  const [attivo, setAttivo] = useState<string>('rate');

  const registra = (k: string) => (e: LayoutChangeEvent) => {
    posizioni.current[k] = e.nativeEvent.layout.y;
  };
  const vai = (k: string) => scrollRef.current?.scrollTo({ y: Math.max(0, (posizioni.current[k] ?? 0) - 24), animated: true });
  const accedi = () => router.push('/login');
  const corrente = CAMPANELLI.find((c) => c.chiave === attivo) ?? CAMPANELLI[0]!;

  return (
    <View style={styles.root}>
      <View role="banner" style={styles.barra}>
        <View style={styles.barraInterna}>
          <BrandMark noTagline />
          {!isMobile ? (
            <View role="navigation" aria-label="Sezioni della pagina" style={styles.nav}>
              <LinkNav label="Servizi" onPress={() => vai('servizi')} />
              <LinkNav label="Per chi è" onPress={() => vai('ruoli')} />
            </View>
          ) : null}
          <View style={styles.barraAccedi}>
            <Button variant="primary" label="Accedi" icon="log-in" iconPosition="end" onPress={accedi} />
          </View>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContenuto}>
        {/* Apertura: frase a sinistra, citofono a destra */}
        <View style={styles.androne}>
          <View style={[styles.colonnaPagina, styles.apertura, !isDesktop && styles.aperturaImpilata]}>
            <View style={[styles.aperturaTesto, isDesktop && styles.aperturaTestoDesktop]}>
              <Text accessibilityRole="header" aria-level={1} style={[styles.titolo, isMobile && styles.titoloMobile]}>
                Il tuo condominio, dal citofono in su.
              </Text>
              <Text style={[textStyle('body', breakpoint), styles.sottotitolo]}>
                Rate, avvisi, guasti e assemblee del tuo palazzo in un unico posto, per chi ci abita, per il portiere e per l’amministratore.
              </Text>
              <View style={[styles.azioni, isMobile && styles.azioniMobile]}>
                <Button variant="primary" label="Accedi al tuo condominio" onPress={accedi} fullWidth={isMobile} />
              </View>
              <Text style={[textStyle('secondary', breakpoint), styles.notaAccesso]}>
                L’accesso arriva su invito del tuo amministratore.
              </Text>
            </View>

            <Citofono attivo={attivo} onScegli={setAttivo} testo={corrente.display} nome={corrente.nome} />
          </View>
        </View>

        {/* Servizi: elenco piano, due colonne su desktop */}
        <View onLayout={registra('servizi')} style={styles.sezione}>
          <View style={styles.colonnaPagina}>
            <Text accessibilityRole="header" aria-level={2} style={[textStyle('h2', breakpoint), styles.titoloSezione]}>
              Cosa trovi dentro
            </Text>
            <View style={[styles.elenco, isDesktop && styles.elencoDesktop]}>
              {CAMPANELLI.map((c) => (
                <View key={c.chiave} style={[styles.voce, isDesktop && styles.voceDesktop]}>
                  <Icon name={c.icona} size="action" color={P.inchiostro} />
                  <View style={styles.voceTesto}>
                    <Text accessibilityRole="header" aria-level={3} style={[textStyle('h4', breakpoint), styles.voceTitolo]}>
                      {c.nome}
                    </Text>
                    <Text style={[textStyle('body', breakpoint), styles.voceDescrizione]}>{c.display}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Ruoli: tre colonne di testo, separate da un filo, come i piani di un palazzo */}
        <View onLayout={registra('ruoli')} style={[styles.sezione, styles.sezioneRuoli]}>
          <View style={styles.colonnaPagina}>
            <Text accessibilityRole="header" aria-level={2} style={[textStyle('h2', breakpoint), styles.titoloSezione]}>
              Una sola app, tre modi di usarla
            </Text>
            <View style={[styles.ruoli, isDesktop && styles.ruoliDesktop]}>
              {RUOLI.map((r, i) => (
                <View key={r.titolo} style={[styles.ruolo, isDesktop && styles.ruoloDesktop, i > 0 && (isDesktop ? styles.ruoloFiloSx : styles.ruoloFiloSu)]}>
                  <Text accessibilityRole="header" aria-level={3} style={[textStyle('h3', breakpoint), styles.ruoloTitolo]}>
                    {r.titolo}
                  </Text>
                  <Text style={[textStyle('body', breakpoint), styles.voceDescrizione]}>{r.testo}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Chiusura */}
        <View style={styles.sezione}>
          <View style={[styles.colonnaPagina, styles.chiusura, isMobile && styles.chiusuraMobile]}>
            <Text accessibilityRole="header" aria-level={2} style={[textStyle('h2', breakpoint), styles.titoloSezione, styles.chiusuraTitolo]}>
              Hai ricevuto l’invito? Entra pure.
            </Text>
            <Button variant="primary" label="Accedi al tuo condominio" onPress={accedi} fullWidth={isMobile} />
          </View>
        </View>

        <View role="contentinfo" style={styles.piede}>
          <View style={[styles.colonnaPagina, styles.piedeRiga, isMobile && styles.piedeRigaMobile]}>
            <BrandMark tone="light" noTagline />
            <Text style={[textStyle('support', breakpoint), styles.piedeTesto]}>
              © {new Date().getFullYear()} IoCondo
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** La pulsantiera: display in alto, un campanello per servizio. */
function Citofono({ attivo, onScegli, testo, nome }: { attivo: string; onScegli: (k: string) => void; testo: string; nome: string }) {
  return (
    <View style={styles.placca}>
      <View style={styles.vite} />
      <View aria-live="polite" style={styles.display}>
        <Text style={styles.displayNome}>{nome}</Text>
        <Text style={styles.displayTesto}>{testo}</Text>
      </View>
      <View role="group" aria-label="Servizi di IoCondo" style={styles.pulsanti}>
        {CAMPANELLI.map((c) => (
          <TastoCampanello key={c.chiave} c={c} premuto={c.chiave === attivo} onPress={() => onScegli(c.chiave)} />
        ))}
      </View>
      <View style={[styles.vite, styles.viteBasso]} />
    </View>
  );
}

function TastoCampanello({ c, premuto, onPress }: { c: Campanello; premuto: boolean; onPress: () => void }) {
  const [focus, setFocus] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: premuto }}
      aria-pressed={premuto}
      onPress={onPress}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={[styles.riga, focus && focusRing, noOutline]}
    >
      <View style={styles.targhetta}>
        <Text style={styles.targhettaTesto} numberOfLines={1}>
          {c.nome}
        </Text>
      </View>
      <View style={[styles.bottone, premuto && styles.bottonePremuto]}>
        <View style={[styles.spia, premuto && styles.spiaAccesa]} />
      </View>
    </Pressable>
  );
}

function LinkNav({ label, onPress }: { label: string; onPress: () => void }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={[styles.linkNav, focus && focusRing, noOutline]}
    >
      <Text style={[styles.linkNavTesto, hover && styles.linkNavHover]}>{label}</Text>
    </Pressable>
  );
}

const noOutline: ViewStyle | undefined = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : undefined;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bianco },
  scroll: { flex: 1 },
  scrollContenuto: { flexGrow: 1 },
  colonnaPagina: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: space[6] },

  barra: { backgroundColor: P.bianco, borderBottomWidth: 1, borderBottomColor: '#DDE3DE' },
  barraInterna: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: space[6], height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[4] },
  // Il Button si allinea in alto da solo (alignSelf): il contenitore lo riporta al centro della barra.
  barraAccedi: { justifyContent: 'center', alignSelf: 'center' },
  nav: { flexDirection: 'row', gap: space[2], marginLeft: 'auto', marginRight: space[4] },
  linkNav: { paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: 6 },
  linkNavTesto: { ...textStyle('label'), color: P.testoTenue },
  linkNavHover: { color: P.inchiostro, textDecorationLine: 'underline' },

  androne: { backgroundColor: P.intonaco, paddingVertical: space[12] },
  apertura: { flexDirection: 'row', alignItems: 'center', gap: space[12] },
  aperturaImpilata: { flexDirection: 'column', alignItems: 'stretch', gap: space[10] },
  aperturaTesto: { gap: space[5] },
  aperturaTestoDesktop: { flex: 1, minWidth: 0 },
  titolo: { ...textStyle('h1'), fontSize: 52, lineHeight: 56, letterSpacing: -1.2, fontWeight: '700', color: P.inchiostro, maxWidth: 560 },
  titoloMobile: { fontSize: 36, lineHeight: 40, letterSpacing: -0.6 },
  sottotitolo: { color: P.testo, maxWidth: 520, lineHeight: 26 },
  azioni: { flexDirection: 'row', marginTop: space[2] },
  azioniMobile: { flexDirection: 'column', alignItems: 'stretch' },
  notaAccesso: { color: P.testoTenue },

  placca: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    backgroundColor: P.ottone,
    borderRadius: 6,
    paddingVertical: space[6],
    paddingHorizontal: space[5],
    gap: space[4],
    borderWidth: 1,
    borderColor: P.ottoneScuro,
    ...Platform.select({
      web: { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.18), 0 18px 30px -18px rgba(13,59,102,0.45)' } as unknown as ViewStyle,
      default: { elevation: 6 },
    }),
  },
  vite: { width: 10, height: 10, borderRadius: 5, backgroundColor: P.ottoneScuro, alignSelf: 'center', opacity: 0.6 },
  viteBasso: { marginTop: space[1] },
  display: { backgroundColor: P.display, borderRadius: 4, padding: space[4], minHeight: 112, gap: space[2], borderWidth: 2, borderColor: P.ottoneScuro },
  displayNome: { ...textStyle('label'), color: P.bianco, fontWeight: '600' },
  displayTesto: { ...textStyle('secondary'), color: P.displayTesto, lineHeight: 20 },
  pulsanti: { gap: space[2] },
  riga: { flexDirection: 'row', alignItems: 'center', gap: space[3], borderRadius: 4, paddingVertical: 2 },
  targhetta: { flex: 1, minWidth: 0, backgroundColor: '#F4F1E6', borderRadius: 2, paddingVertical: 6, paddingHorizontal: space[3], borderWidth: 1, borderColor: P.ottoneScuro },
  targhettaTesto: { ...textStyle('secondary'), color: P.testo, fontWeight: '500' },
  bottone: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#C9AE6A', borderWidth: 2, borderColor: P.ottoneScuro, alignItems: 'center', justifyContent: 'center' },
  bottonePremuto: { backgroundColor: '#8F722F', transform: [{ scale: 0.94 }] },
  spia: { width: 8, height: 8, borderRadius: 4, backgroundColor: P.ottoneScuro },
  spiaAccesa: { backgroundColor: '#7CF0B0' },

  sezione: { paddingVertical: space[12] },
  sezioneRuoli: { backgroundColor: '#F5F7F5' },
  titoloSezione: { color: P.inchiostro, marginBottom: space[8], maxWidth: 640 },
  elenco: { gap: space[8] },
  elencoDesktop: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[12], rowGap: space[8] },
  voce: { flexDirection: 'row', alignItems: 'flex-start', gap: space[4] },
  voceDesktop: { width: '46%' },
  voceTesto: { flex: 1, minWidth: 0, gap: space[1] },
  voceTitolo: { color: P.testo },
  voceDescrizione: { color: P.testoTenue, lineHeight: 24, maxWidth: 520 },

  ruoli: { gap: 0 },
  ruoliDesktop: { flexDirection: 'row' },
  ruolo: { gap: space[2], paddingVertical: space[5] },
  ruoloDesktop: { flex: 1, paddingVertical: 0, paddingHorizontal: space[6] },
  ruoloFiloSx: { borderLeftWidth: 1, borderLeftColor: '#CBD3CD' },
  ruoloFiloSu: { borderTopWidth: 1, borderTopColor: '#CBD3CD' },
  ruoloTitolo: { color: P.inchiostro },

  chiusura: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[6] },
  chiusuraMobile: { flexDirection: 'column', alignItems: 'stretch' },
  chiusuraTitolo: { marginBottom: 0, flexShrink: 1 },

  piede: { backgroundColor: P.inchiostro, paddingVertical: space[8] },
  piedeRiga: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[4] },
  piedeRigaMobile: { flexDirection: 'column', alignItems: 'flex-start' },
  piedeTesto: { color: '#C7D3E0' },
});
