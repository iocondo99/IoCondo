import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { destinazioneNotifica, homeDi, nomeVisibile, type Vista } from '@iocondo/data';
import {
  Avatar,
  Dropdown,
  Icon,
  NotificationPanel,
  SearchBar,
  borderWidths,
  colors,
  layout,
  space,
  textStyle,
  useBreakpoint,
  useToast,
  type DropdownItem,
} from '@iocondo/ui';
import { BrandMark } from '@/components/Brand';
import { useAuth } from '@/context/AuthContext';
import { useProfilo } from '@/context/ProfiloContext';
import { useNotifiche, type NotificaItemUI } from '@/hooks/useNotifiche';

/**
 * Header (sez. 5.2). Desktop: ricerca, condominio, vista, notifiche e profilo. Tablet: senza ricerca e con
 * il solo avatar. Smartphone: compatto, con logo, notifiche e profilo; condominio e vista stanno in "Altro".
 */
export function Header() {
  const { isDesktop, isMobile, breakpoint } = useBreakpoint();
  const { user, signOut } = useAuth();
  const profilo = useProfilo();
  const router = useRouter();
  const toast = useToast();
  const notifiche = useNotifiche(user?.id ?? null);

  const nome = profilo.profilo ? nomeVisibile(profilo.profilo) : (user?.email ?? 'Utente');
  const ruolo = profilo.etichettaVista;
  const condomini = profilo.profilo?.condomini ?? [];

  const cambiaVista = (vista: Vista) => {
    profilo.setVista(vista);
    router.replace(homeDi(vista) as Href);
  };

  const vociVista: DropdownItem[] = profilo.viste.map((vista) => ({
    key: vista,
    label: profilo.etichettaDi(vista),
    selected: vista === profilo.vista,
    onPress: () => cambiaVista(vista),
  }));
  const vociCondominio: DropdownItem[] = condomini.map((c) => ({
    key: c.id,
    label: c.nome,
    icon: 'building-2',
    selected: c.id === profilo.condominio?.id,
    onPress: () => profilo.setCondominioId(c.id),
  }));

  const impostazioni = profilo.voci.find((v) => v.id === 'impostazioni');
  const vociProfilo: DropdownItem[] = [
    ...(impostazioni
      ? [{ key: 'impostazioni', label: 'Impostazioni', icon: 'settings' as const, onPress: () => router.push(impostazioni.route as Href) }]
      : []),
    {
      key: 'esci',
      label: 'Esci dall’account',
      icon: 'log-out',
      onPress: async () => {
        const esito = await signOut();
        if (!esito.ok) toast.show({ tone: 'error', message: esito.message });
      },
    },
  ];

  return (
    <View
      role="banner"
      style={[styles.root, { minHeight: isMobile ? layout.compactHeaderHeight : layout.headerHeight }]}
    >
      {isMobile ? <BrandMark tone="light" noTagline /> : null}
      {isDesktop ? (
        <View style={styles.ricerca}>
          {/* La ricerca non ha ancora dati da cercare: resta disattivata e lo dice, invece di sembrare rotta. */}
          <SearchBar
            value=""
            onChangeText={() => undefined}
            disabled
            label="Cerca, non ancora disponibile"
            placeholder="La ricerca sarà disponibile a breve"
          />
        </View>
      ) : null}
      <View style={styles.spazio} />

      {!isMobile && condomini.length === 1 ? (
        <View style={styles.condominio}>
          <Icon name="building-2" size="action" color={colors.brand.navy} />
          <Text numberOfLines={1} style={[textStyle('label', breakpoint), styles.condominioNome]}>
            {condomini[0]?.nome}
          </Text>
        </View>
      ) : null}
      {!isMobile && condomini.length > 1 ? (
        <Dropdown
          label={`Condominio: ${profilo.condominio?.nome ?? 'scegli'}`}
          icon="building-2"
          items={vociCondominio}
          align="end"
        />
      ) : null}
      {!isMobile && profilo.viste.length > 1 ? (
        <Dropdown label={`Vista: ${ruolo}`} items={vociVista} align="end" />
      ) : null}

      <NotificationPanel
        notifications={notifiche.elenco}
        unreadCount={notifiche.totaleNonLette}
        loading={notifiche.caricamento}
        error={notifiche.errore}
        onRetry={notifiche.ricarica}
        onOpen={() => void notifiche.ricarica()}
        onViewAll={() => router.push('/notifiche' as Href)}
        onSelect={async (item) => {
          const notificaItem = item as NotificaItemUI;
          try {
            await notifiche.segnaLetta(item.id);
          } catch {
            // Se fallisce l'aggiornamento sul server viene ripristinata la lista
          }
          if (notificaItem.raw && profilo.vista) {
            const dest = destinazioneNotifica(notificaItem.raw, profilo.vista);
            if (dest) {
              router.push(dest as Href);
            }
          }
        }}
        onMarkAllRead={async () => {
          try {
            await notifiche.segnaTutteLette();
          } catch {
            toast.show({ tone: 'error', message: 'Non è stato possibile aggiornare le notifiche. Riprova.' });
          }
        }}
      />

      <Dropdown
        label={`Menu del profilo: ${nome}, ${ruolo}`}
        items={vociProfilo}
        align="end"
        triggerContent={
          <>
            <Avatar name={nome} size="md" imageUri={profilo.profilo?.avatarUrl ?? undefined} />
            {isDesktop ? (
              <>
                <View style={styles.identita}>
                  <Text numberOfLines={1} style={[textStyle('label', breakpoint), styles.nome]}>
                    {nome}
                  </Text>
                  <Text numberOfLines={1} style={[textStyle('secondary', breakpoint), styles.ruolo]}>
                    {ruolo}
                  </Text>
                </View>
                <Icon name="chevron-down" size="action" color={colors.brand.navy} />
              </>
            ) : null}
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    backgroundColor: colors.surface,
    borderBottomWidth: borderWidths.thin,
    borderBottomColor: colors.border,
  },
  ricerca: { flexGrow: 0, flexShrink: 1, flexBasis: layout.formMaxWidth, minWidth: 220 },
  spazio: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  condominio: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexShrink: 1 },
  condominioNome: { color: colors.brand.navy, flexShrink: 1 },
  identita: { maxWidth: layout.sidebarWidth },
  nome: { color: colors.text.primary },
  ruolo: { color: colors.text.secondary },
});
