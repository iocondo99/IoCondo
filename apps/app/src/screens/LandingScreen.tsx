import React, { useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  borderWidths,
  colors,
  feedbackSizes,
  focusRing,
  radii,
  space,
  textStyle,
  touchTarget,
  useBreakpoint,
  Button,
  Icon,
  type IconName,
} from '@iocondo/ui';
import { BrandMark } from '@/components/Brand';

interface RoleCardItem {
  icon: IconName;
  tile: keyof typeof colors.tile;
  title: string;
  roleBadge: string;
  description: string;
  highlights: string[];
}

const RUOLI_DATA: RoleCardItem[] = [
  {
    icon: 'users',
    tile: 'blue',
    title: 'Per i Condòmini',
    roleBadge: 'Abitanti & Proprietari',
    description:
      'Tutto sotto controllo in un tocco: consulta la tua situazione contabile, leggi gli avvisi e vivi il palazzo con serenità.',
    highlights: [
      'Rate, scadenze e ripartizioni sempre trasparenti',
      'Bacheca avvisi in evidenza per scala e stabile',
      'Segnalazione guasti rapida sulle parti comuni',
      'Prenotazione spazi comuni e raccolta differenziata',
    ],
  },
  {
    icon: 'package',
    tile: 'teal',
    title: 'Per il Portiere',
    roleBadge: 'Presidio & Custodia',
    description:
      'Il compagno di lavoro quotidiano: traccia pacchi e consegne, gestisci le chiavi e registra anomalie all’istante.',
    highlights: [
      'Registro pacchi digitale con firma al ritiro',
      'Segnalazione guasti sulle aree comuni in tempo reale',
      'Nessun foglio volante né quaderno cartaceo',
      'Notifiche immediate ai residenti all’arrivo dei corrieri',
    ],
  },
  {
    icon: 'building-2',
    tile: 'navy',
    title: 'Per l’Amministratore',
    roleBadge: 'Gestione Professionale',
    description:
      'Massima efficienza e serenità legale: conduci le assemblee, tieni la contabilità e dialoga con i condòmini a prova di legge.',
    highlights: [
      'Assemblee con quorum costitutivi ex art. 1136 c.c.',
      'Contabilità analitica e registri cronologici',
      'Gestione fornitori convenzionati con link sicuri',
      'Comunicazioni certificate multicanale',
    ],
  },
];

interface FeatureCardItem {
  icon: IconName;
  tile: keyof typeof colors.tile;
  title: string;
  description: string;
}

const FUNZIONALITA_DATA: FeatureCardItem[] = [
  {
    icon: 'bell',
    tile: 'blue',
    title: 'Bacheca & Avvisi',
    description:
      'Comunicazioni ufficiali dell’amministratore, avvisi fissati per palazzo e notifiche in tempo reale per non perdere nulla.',
  },
  {
    icon: 'coins',
    tile: 'teal',
    title: 'Spese e Scadenze Chiare',
    description:
      'Nessuna sorpresa: visualizza importi dovuti, rateizzazioni e ripartizioni millesimali con chiarezza cristallina.',
  },
  {
    icon: 'wrench',
    tile: 'navy',
    title: 'Guasti & Manutenzione',
    description:
      'Segnalazioni veloci con foto per scala e palazzo, tracciamento degli interventi e fornitori convenzionati.',
  },
  {
    icon: 'calendar-days',
    tile: 'violet',
    title: 'Prenotazione Spazi Comuni',
    description:
      'Prenota campi da tennis, sale riunioni o lavanderia con verifica automatica delle sovrapposizioni.',
  },
  {
    icon: 'recycle',
    tile: 'teal',
    title: 'Raccolta Differenziata',
    description:
      'Calendario settimanale e promemoria "Oggi e Domani" per sapere sempre quale bidone esporre ed evitare sanzioni.',
  },
  {
    icon: 'file-text',
    tile: 'navy',
    title: 'Assemblee & Documenti Protetti',
    description:
      'Convocazioni, quorum legali ex art. 1136 c.c., votazioni nominali e verbali firmati consultabili con link protetti.',
  },
];

interface TrustPillarItem {
  icon: IconName;
  title: string;
  subtitle: string;
}

const TRUST_PILLARS: TrustPillarItem[] = [
  {
    icon: 'smartphone',
    title: '100% Mobile-first',
    subtitle: 'Nessun download obbligato: accessibile su smartphone, tablet e desktop',
  },
  {
    icon: 'shield-check',
    title: 'Zero pagamenti simulati',
    subtitle: 'Solo canali ufficiali e sicurezza bancaria autentica',
  },
  {
    icon: 'bell',
    title: 'Notifiche in tempo reale',
    subtitle: 'Avvisi istantanei per scadenze, interventi urgenti e bacheca',
  },
  {
    icon: 'file-text',
    title: 'Privacy ex art. 1130 c.c.',
    subtitle: 'Protezione dati rigorosa, registri di anagrafe e accessi separati',
  },
];

export function LandingScreen() {
  const router = useRouter();
  const { breakpoint, isDesktop, isTablet, isMobile } = useBreakpoint();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [logoFocused, setLogoFocused] = useState(false);
  const sectionPositions = useRef<Record<string, number>>({});

  const recordSectionY = (key: string) => (event: LayoutChangeEvent) => {
    sectionPositions.current[key] = event.nativeEvent.layout.y;
  };

  const scrollToSection = (key: string) => {
    const y = sectionPositions.current[key] ?? 0;
    const offset = 80;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - offset), animated: true });
  };

  return (
    <View style={styles.root}>
      {/* Top Navigation Bar fissa / in evidenza */}
      <View role="banner" style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable
            accessible
            role="link"
            aria-label="ioCondo Home"
            accessibilityLabel="ioCondo Home"
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            onFocus={() => setLogoFocused(true)}
            onBlur={() => setLogoFocused(false)}
            style={[
              styles.logoPressable,
              logoFocused && focusRing,
            ]}
          >
            <BrandMark noTagline />
          </Pressable>

          {/* Navigazione centrale visibile da tablet in su */}
          {!isMobile && (
            <View role="navigation" aria-label="Navigazione principale" style={styles.navLinks}>
              <NavLink label="Funzionalità" onPress={() => scrollToSection('funzionalita')} />
              <NavLink label="Per chi è" onPress={() => scrollToSection('ruoli')} />
              <NavLink label="Vantaggi" onPress={() => scrollToSection('vantaggi')} />
            </View>
          )}

          <View style={styles.headerActions}>
            <Button
              variant="primary"
              label="Accedi"
              icon="log-in"
              iconPosition="end"
              onPress={() => router.push('/login')}
              accessibilityHint="Apre la schermata di accesso a ioCondo"
            />
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* HERO SECTION */}
        <View style={styles.heroSection}>
          <View style={styles.heroInner}>
            {/* Badge pillola con accento Teal */}
            <View style={styles.pillBadge}>
              <Icon name="sparkles" size="indicator" color={colors.tile.teal.foreground} />
              <Text style={[textStyle('label', breakpoint), styles.pillBadgeText]}>
                La nuova gestione condominiale digitale e trasparente
              </Text>
            </View>

            {/* Titolo H1 principale */}
            <Text
              accessibilityRole="header"
              aria-level={1}
              style={[
                textStyle('h1', breakpoint),
                styles.heroTitle,
                isDesktop && styles.heroTitleDesktop,
              ]}
            >
              La vita in condominio, finalmente semplice e senza stress
            </Text>

            {/* Sottotitolo chiaro ed empatico */}
            <Text style={[textStyle('body', breakpoint), styles.heroSubtitle]}>
              La piattaforma moderna che unisce condòmini, portieri e amministratori: comunicazioni
              chiare, rate e spese sotto controllo, gestione rapida dei guasti e verbali a norma di
              legge in un unico spazio intuitivo.
            </Text>

            {/* Gruppo pulsanti CTA */}
            <View style={[styles.ctaGroup, isMobile && styles.ctaGroupMobile]}>
              <Button
                variant="primary"
                label="Entra nel tuo condominio"
                icon="arrow-right"
                iconPosition="end"
                onPress={() => router.push('/login')}
                fullWidth={isMobile}
              />
              <Button
                variant="secondary"
                label="Scopri le funzionalità"
                icon="chevron-down"
                iconPosition="end"
                onPress={() => scrollToSection('funzionalita')}
                fullWidth={isMobile}
              />
            </View>
          </View>
        </View>

        {/* METRICHE DI FIDUCIA E VANTAGGI */}
        <View
          onLayout={recordSectionY('vantaggi')}
          style={styles.sectionContainer}
        >
          <View style={styles.trustCard}>
            <View
              style={[
                styles.trustGrid,
                isDesktop ? styles.trustGridDesktop : isTablet ? styles.trustGridTablet : styles.trustGridMobile,
              ]}
            >
              {TRUST_PILLARS.map((pillar) => (
                <View key={pillar.title} style={styles.trustItem}>
                  <View style={styles.trustIconWrapper}>
                    <Icon name={pillar.icon} size="action" color={colors.action.default} />
                  </View>
                  <View style={styles.trustTextGroup}>
                    <Text style={[textStyle('h4', breakpoint), styles.trustTitle]}>
                      {pillar.title}
                    </Text>
                    <Text style={[textStyle('secondary', breakpoint), styles.trustSubtitle]}>
                      {pillar.subtitle}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* SEZIONE "PER CHI È" (I 3 RUOLI) */}
        <View
          onLayout={recordSectionY('ruoli')}
          style={styles.sectionContainer}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBadge}>
              <Text style={[textStyle('label', breakpoint), styles.sectionBadgeText]}>
                PER CHI È
              </Text>
            </View>
            <Text accessibilityRole="header" aria-level={2} style={[textStyle('h2', breakpoint), styles.sectionTitle]}>
              Pensato su misura per ogni protagonista del condominio
            </Text>
            <Text style={[textStyle('body', breakpoint), styles.sectionSubtitle]}>
              Un’unica piattaforma intelligente, con viste ed esperienze personalizzate in base al ruolo.
            </Text>
          </View>

          <View
            style={[
              styles.rolesGrid,
              isDesktop ? styles.rolesGridDesktop : styles.rolesGridColumn,
            ]}
          >
            {RUOLI_DATA.map((item) => {
              const tileColor = colors.tile[item.tile];
              return (
                <View key={item.title} style={styles.roleCard}>
                  <View style={styles.roleCardTop}>
                    <View style={[styles.tileBox, { backgroundColor: tileColor.background }]}>
                      <Icon name={item.icon} size="card" color={tileColor.foreground} />
                    </View>
                    <View style={styles.roleBadgePill}>
                      <Text style={[textStyle('support', breakpoint), styles.roleBadgeText]}>
                        {item.roleBadge}
                      </Text>
                    </View>
                  </View>

                  <Text accessibilityRole="header" aria-level={3} style={[textStyle('h3', breakpoint), styles.roleTitle]}>
                    {item.title}
                  </Text>
                  <Text style={[textStyle('secondary', breakpoint), styles.roleDescription]}>
                    {item.description}
                  </Text>

                  <View style={styles.roleDivider} />

                  <View style={styles.highlightsList}>
                    {item.highlights.map((point) => (
                      <View key={point} style={styles.highlightRow}>
                        <View style={styles.checkCircle}>
                          <Icon name="check" size="indicator" color={colors.action.default} />
                        </View>
                        <Text style={[textStyle('secondary', breakpoint), styles.highlightText]}>
                          {point}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* GRIGLIA DELLE FUNZIONALITÀ CHIAVE (SHOWCASE) */}
        <View
          onLayout={recordSectionY('funzionalita')}
          style={styles.sectionContainer}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBadge}>
              <Text style={[textStyle('label', breakpoint), styles.sectionBadgeText]}>
                FUNZIONALITÀ CHIAVE
              </Text>
            </View>
            <Text accessibilityRole="header" aria-level={2} style={[textStyle('h2', breakpoint), styles.sectionTitle]}>
              Tutto ciò che serve, a portata di click
            </Text>
            <Text style={[textStyle('body', breakpoint), styles.sectionSubtitle]}>
              Strumenti coordinati, progettati secondo la legge e testati per essere usati da chiunque senza difficoltà.
            </Text>
          </View>

          <View
            style={[
              styles.featuresGrid,
              isDesktop
                ? styles.featuresGridDesktop
                : isTablet
                ? styles.featuresGridTablet
                : styles.featuresGridMobile,
            ]}
          >
            {FUNZIONALITA_DATA.map((item) => {
              const tileColor = colors.tile[item.tile];
              return (
                <View
                  key={item.title}
                  style={[
                    styles.featureCard,
                    isDesktop
                      ? styles.featureCardDesktop
                      : isTablet
                      ? styles.featureCardTablet
                      : styles.featureCardMobile,
                  ]}
                >
                  <View style={[styles.tileBox, { backgroundColor: tileColor.background }]}>
                    <Icon name={item.icon} size="card" color={tileColor.foreground} />
                  </View>
                  <Text accessibilityRole="header" aria-level={3} style={[textStyle('h4', breakpoint), styles.featureTitle]}>
                    {item.title}
                  </Text>
                  <Text style={[textStyle('secondary', breakpoint), styles.featureDescription]}>
                    {item.description}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* BANNER CTA FINALE */}
        <View style={styles.sectionContainer}>
          <View style={styles.finalCtaCard}>
            <View style={styles.finalCtaInner}>
              <View style={styles.finalCtaBadge}>
                <Icon name="sparkles" size="indicator" color={colors.tile.teal.background} />
                <Text style={[textStyle('label', breakpoint), styles.finalCtaBadgeText]}>
                  Inizia oggi
                </Text>
              </View>

              <Text
                accessibilityRole="header"
                aria-level={2}
                style={[textStyle('h2', breakpoint), styles.finalCtaTitle]}
              >
                Pronto a vivere il tuo condominio in modo digitale?
              </Text>

              <Text style={[textStyle('body', breakpoint), styles.finalCtaSubtitle]}>
                Accedi subito con le tue credenziali e scopri tutte le comunicazioni, le rate e i servizi del tuo palazzo.
              </Text>

              <View style={styles.finalCtaButtonWrapper}>
                <Button
                  variant="primary"
                  label="Accedi ora a ioCondo"
                  icon="arrow-right"
                  iconPosition="end"
                  onPress={() => router.push('/login')}
                  fullWidth={isMobile}
                />
              </View>
            </View>
          </View>
        </View>

        {/* FOOTER ISTITUZIONALE */}
        <View role="contentinfo" style={styles.footer}>
          <View style={styles.footerInner}>
            <View style={styles.footerTopRow}>
              <BrandMark tone="light" />
              <Text style={[textStyle('secondary', breakpoint), styles.footerTagline]}>
                Gestione condominiale moderna, trasparente e conforme alla legge.
              </Text>
            </View>

            <View style={styles.footerDivider} />

            <View style={[styles.footerBottomRow, isMobile && styles.footerBottomRowMobile]}>
              <Text style={[textStyle('support', breakpoint), styles.footerCopyright]}>
                © {new Date().getFullYear()} ioCondo. Tutti i diritti riservati.
              </Text>
              <Text style={[textStyle('support', breakpoint), styles.footerLegal]}>
                Accessibilità conforme WCAG 2.2 AA · Trasparenza art. 1130 c.c.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

interface NavLinkProps {
  label: string;
  onPress: () => void;
}

function NavLink({ label, onPress }: NavLinkProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { breakpoint } = useBreakpoint();

  return (
    <Pressable
      accessible
      role="link"
      accessibilityRole="link"
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.navLink,
        hovered && styles.navLinkHovered,
        focused && focusRing,
      ]}
    >
      <Text
        style={[
          textStyle('label', breakpoint),
          styles.navLinkText,
          hovered && styles.navLinkTextHovered,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const noOutline: ViewStyle | undefined =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : undefined;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  headerInner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
  },
  logoPressable: {
    borderRadius: radii.control,
    minHeight: touchTarget.control,
    justifyContent: 'center',
    ...noOutline,
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  navLink: {
    minHeight: touchTarget.control,
    paddingHorizontal: space[4],
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.control,
    ...noOutline,
  },
  navLinkHovered: {
    backgroundColor: colors.tile.blue.background,
  },
  navLinkText: {
    color: colors.text.secondary,
  },
  navLinkTextHovered: {
    color: colors.action.default,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: space[12],
  },
  heroSection: {
    width: '100%',
    backgroundColor: colors.surface,
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
    paddingVertical: space[12],
    paddingHorizontal: space[6],
    alignItems: 'center',
  },
  heroInner: {
    width: '100%',
    maxWidth: 960,
    alignItems: 'center',
    textAlign: 'center',
    gap: space[5],
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: colors.tile.teal.background,
    borderColor: colors.brand.teal,
    borderWidth: borderWidths.thin,
    paddingVertical: space[1],
    paddingHorizontal: space[3],
    borderRadius: radii.full,
  },
  pillBadgeText: {
    color: colors.tile.teal.foreground,
  },
  heroTitle: {
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 38,
  },
  heroTitleDesktop: {
    fontSize: 40,
    lineHeight: 48,
  },
  heroSubtitle: {
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 720,
  },
  ctaGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    marginTop: space[3],
  },
  ctaGroupMobile: {
    flexDirection: 'column',
    width: '100%',
  },
  sectionContainer: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: space[6],
    paddingTop: space[12],
  },
  trustCard: {
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: space[6],
  },
  trustGrid: {
    gap: space[6],
  },
  trustGridDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trustGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  trustGridMobile: {
    flexDirection: 'column',
  },
  trustItem: {
    flex: 1,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  trustIconWrapper: {
    width: space[10],
    height: space[10],
    borderRadius: radii.control,
    backgroundColor: colors.tile.blue.background,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  trustTextGroup: {
    flex: 1,
    gap: space[1],
  },
  trustTitle: {
    color: colors.text.primary,
  },
  trustSubtitle: {
    color: colors.text.secondary,
  },
  sectionHeader: {
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: space[8],
    gap: space[3],
  },
  sectionBadge: {
    backgroundColor: colors.tile.navy.background,
    paddingVertical: space[1],
    paddingHorizontal: space[3],
    borderRadius: radii.badge,
  },
  sectionBadgeText: {
    color: colors.brand.navy,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    color: colors.text.primary,
    textAlign: 'center',
  },
  sectionSubtitle: {
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 640,
  },
  rolesGrid: {
    gap: space[6],
  },
  rolesGridDesktop: {
    flexDirection: 'row',
  },
  rolesGridColumn: {
    flexDirection: 'column',
  },
  roleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: space[6],
    gap: space[4],
  },
  roleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileBox: {
    width: feedbackSizes.tile,
    height: feedbackSizes.tile,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgePill: {
    backgroundColor: colors.background,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radii.full,
  },
  roleBadgeText: {
    color: colors.text.secondary,
  },
  roleTitle: {
    color: colors.text.primary,
  },
  roleDescription: {
    color: colors.text.secondary,
  },
  roleDivider: {
    height: borderWidths.thin,
    backgroundColor: colors.border,
  },
  highlightsList: {
    gap: space[3],
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
  },
  checkCircle: {
    width: space[5],
    height: space[5],
    borderRadius: radii.full,
    backgroundColor: colors.tile.blue.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[1],
  },
  highlightText: {
    flex: 1,
    color: colors.text.primary,
  },
  featuresGrid: {
    gap: space[6],
  },
  featuresGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  featuresGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  featuresGridMobile: {
    flexDirection: 'column',
  },
  featureCard: {
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: space[6],
    gap: space[3],
  },
  featureCardDesktop: {
    flexGrow: 1,
    flexBasis: '30%',
    maxWidth: '32%',
  },
  featureCardTablet: {
    flexGrow: 1,
    flexBasis: '47%',
    maxWidth: '49%',
  },
  featureCardMobile: {
    width: '100%',
  },
  featureTitle: {
    color: colors.text.primary,
  },
  featureDescription: {
    color: colors.text.secondary,
  },
  finalCtaCard: {
    backgroundColor: colors.brand.navy,
    borderRadius: radii.card,
    padding: space[10],
    alignItems: 'center',
  },
  finalCtaInner: {
    width: '100%',
    maxWidth: 720,
    alignItems: 'center',
    textAlign: 'center',
    gap: space[4],
  },
  finalCtaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: space[1],
    paddingHorizontal: space[3],
    borderRadius: radii.full,
  },
  finalCtaBadgeText: {
    color: colors.tile.teal.background,
  },
  finalCtaTitle: {
    color: colors.text.inverse,
    textAlign: 'center',
  },
  finalCtaSubtitle: {
    color: colors.tile.navy.background,
    textAlign: 'center',
  },
  finalCtaButtonWrapper: {
    marginTop: space[4],
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: borderWidths.thin,
    borderTopColor: colors.border,
    marginTop: space[12],
    paddingVertical: space[8],
    paddingHorizontal: space[6],
  },
  footerInner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    gap: space[6],
  },
  footerTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[4],
  },
  footerTagline: {
    color: colors.text.muted,
  },
  footerDivider: {
    height: borderWidths.thin,
    backgroundColor: colors.border,
  },
  footerBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[4],
  },
  footerBottomRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  footerCopyright: {
    color: colors.text.muted,
  },
  footerLegal: {
    color: colors.text.muted,
  },
});
