import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  destinazioneNotifica,
  homeDi,
  type Vista,
} from '@iocondo/data';
import type { INotifica } from '@iocondo/shared-types';
import {
  Badge,
  Button,
  FilterChips,
  LoadingState,
  Modal,
  ModalActions,
  PageHeader,
  Pagination,
  ResponsiveDataView,
  colors,
  formatDate,
  space,
  textStyle,
  useToast,
  type DataColumn,
  type FilterOption,
} from '@iocondo/ui';
import { useAuth } from '@/context/AuthContext';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

const LIMITE_PAGINA = 10;

const OPZIONI_FILTRI: readonly FilterOption[] = [
  { value: 'non-lette', label: 'Da leggere' },
];

function etichettaTipo(tipo: string | null): string {
  if (!tipo) return 'Generale';
  switch (tipo.toUpperCase()) {
    case 'BACHECA':
    case 'COMUNICAZIONE':
      return 'Bacheca';
    case 'ASSEMBLEA':
      return 'Assemblea';
    case 'SEGNALAZIONE':
    case 'TICKET':
      return 'Segnalazioni';
    case 'DOCUMENTO':
      return 'Documenti';
    case 'PAGAMENTO':
    case 'RATA':
      return 'Pagamenti';
    case 'SPESA':
      return 'Spese';
    default:
      return tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase();
  }
}

/** Schermata completa del centro notifiche con storico, paginazione e navigazione al dettaglio. */
export function NotificheScreen() {
  const { user } = useAuth();
  const profilo = useProfilo();
  const router = useRouter();
  const toast = useToast();

  const [pagina, setPagina] = useState(1);
  const [soloNonLette, setSoloNonLette] = useState(false);
  const [notifiche, setNotifiche] = useState<INotifica[]>([]);
  const [totale, setTotale] = useState(0);
  const [caricamento, setCaricamento] = useState(true);
  const [operazioneInCorso, setOperazioneInCorso] = useState(false);
  const [notificaDettaglio, setNotificaDettaglio] = useState<INotifica | null>(null);

  const vistaAttiva: Vista = profilo.vista ?? 'RESIDENTE';
  const percorsoHome = homeDi(vistaAttiva) as Href;

  const breadcrumbs = useMemo(
    () => [
      { label: 'Home', onPress: () => router.push(percorsoHome) },
      { label: 'Notifiche' },
    ],
    [router, percorsoHome],
  );

  const caricaNotifiche = useCallback(async () => {
    if (!user?.id) return;
    setCaricamento(true);
    try {
      const da = (pagina - 1) * LIMITE_PAGINA;
      const res = await services.profilo.listMieNotifichePagina(user.id, {
        soloNonLette,
        da,
        limite: LIMITE_PAGINA,
      });
      setNotifiche(res.righe);
      setTotale(res.totale);
    } catch {
      toast.show({ tone: 'error', message: 'Impossibile caricare le notifiche. Riprova.' });
    } finally {
      setCaricamento(false);
    }
  }, [user?.id, pagina, soloNonLette, toast]);

  useEffect(() => {
    void caricaNotifiche();
  }, [caricaNotifiche]);

  const segnaTutteComeLette = async () => {
    if (!user?.id || operazioneInCorso) return;
    setOperazioneInCorso(true);
    try {
      await services.profilo.segnaMieNotificheLette(user.id);
      toast.show({ tone: 'info', message: 'Tutte le notifiche sono state contrassegnate come lette.' });
      await caricaNotifiche();
    } catch {
      toast.show({ tone: 'error', message: 'Errore durante l\'aggiornamento delle notifiche.' });
    } finally {
      setOperazioneInCorso(false);
    }
  };

  const gestisciAperturaNotifica = async (item: INotifica) => {
    if (!user?.id) return;

    if (!item.letta) {
      // Aggiornamento ottimistico locale
      setNotifiche((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, letta: true } : n)),
      );
      try {
        await services.profilo.segnaNotificaLetta(user.id, item.id);
      } catch {
        // Fallimento silenzioso o ripristino al reload
      }
    }

    const destinazione = destinazioneNotifica(item, vistaAttiva);
    if (destinazione) {
      router.push(destinazione as Href);
    } else {
      setNotificaDettaglio(item);
    }
  };

  const pageCount = Math.max(1, Math.ceil(totale / LIMITE_PAGINA));

  const colonne: readonly DataColumn<INotifica>[] = useMemo(
    () => [
      {
        key: 'titolo',
        header: 'Titolo',
        cell: (n) => (
          <Text
            style={[
              styles.testoTitolo,
              !n.letta && styles.testoInEvidenza,
            ]}
          >
            {n.titolo}
          </Text>
        ),
        mobile: 'title',
        minWidth: 200,
        weight: 3,
      },
      {
        key: 'corpo',
        header: 'Messaggio',
        cell: (n) => (
          <Text style={styles.testoCorpo}>
            {n.corpo ?? '—'}
          </Text>
        ),
        mobileLabel: 'Messaggio',
        minWidth: 280,
        weight: 4,
      },
      {
        key: 'tipo',
        header: 'Categoria',
        cell: (n) => (
          <Text style={styles.testoSecondario}>{etichettaTipo(n.tipo)}</Text>
        ),
        mobileLabel: 'Categoria',
        minWidth: 120,
        weight: 1,
      },
      {
        key: 'data',
        header: 'Data e Ora',
        cell: (n) => (
          <Text style={styles.testoData}>{formatDate(n.created_at)}</Text>
        ),
        mobileLabel: 'Data',
        minWidth: 140,
        weight: 2,
      },
      {
        key: 'stato',
        header: 'Stato',
        cell: (n) => (
          <Badge
            status={n.letta ? 'neutral' : 'info'}
            label={n.letta ? 'Letta' : 'Da leggere'}
          />
        ),
        mobile: 'status',
        minWidth: 130,
        weight: 1,
      },
    ],
    [],
  );

  const nonLettePresenti = notifiche.some((n) => !n.letta);

  return (
    <View style={styles.pagina}>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title="Notifiche"
        subtitle="Centro notifiche, avvisi di bacheca, scadenze e comunicazioni del condominio."
        action={
          nonLettePresenti
            ? {
                label: 'Segna tutte come lette',
                icon: 'check',
                onPress: () => void segnaTutteComeLette(),
              }
            : undefined
        }
      />

      <ResponsiveDataView<INotifica>
        label="Elenco notifiche utente"
        columns={colonne}
        rows={notifiche}
        getRowKey={(n) => n.id}
        getRowLabel={(n) => `${n.letta ? 'Letta' : 'Nuova'}: ${n.titolo}`}
        onRowPress={(n) => void gestisciAperturaNotifica(n)}
        filters={
          <FilterChips
            label="Filtra notifiche"
            options={OPZIONI_FILTRI}
            value={soloNonLette ? ['non-lette'] : []}
            onChange={(scelte) => {
              setSoloNonLette(scelte.includes('non-lette'));
              setPagina(1);
            }}
          />
        }
        pagination={
          pageCount > 1 ? (
            <Pagination
              page={pagina}
              pageCount={pageCount}
              onChange={setPagina}
              label="Pagine notifiche"
            />
          ) : null
        }
        empty={{
          title: soloNonLette ? 'Nessuna notifica da leggere' : 'Nessuna notifica',
          description: soloNonLette
            ? 'Hai letto tutte le tue notifiche. Seleziona "Tutti" per consultare lo storico.'
            : 'Non ci sono notifiche per il tuo account in questo momento.',
        }}
      />
      {caricamento && notifiche.length === 0 ? (
        <LoadingState message="Caricamento notifiche in corso..." />
      ) : null}

      {/* Modale Dettaglio Notifica (per notifiche informative prive di un oggetto esterno navigabile) */}
      <Modal
        visible={!!notificaDettaglio}
        onClose={() => setNotificaDettaglio(null)}
        title={notificaDettaglio?.titolo ?? 'Dettaglio notifica'}
        description={
          notificaDettaglio
            ? `${etichettaTipo(notificaDettaglio.tipo)} · ${formatDate(notificaDettaglio.created_at)}`
            : undefined
        }
        actions={
          <ModalActions>
            <Button
              variant="secondary"
              label="Chiudi"
              onPress={() => setNotificaDettaglio(null)}
            />
          </ModalActions>
        }
      >
        <View style={styles.corpoModaleNotifica}>
          <Text style={styles.testoCorpoDettaglio}>
            {notificaDettaglio?.corpo || 'Nessun messaggio aggiuntivo presente per questa notifica.'}
          </Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    alignSelf: 'stretch',
    width: '100%',
    gap: space[6],
  },
  testoTitolo: {
    ...textStyle('body'),
    color: colors.text.primary,
  },
  testoInEvidenza: {
    fontWeight: '700',
    color: colors.brand.navy,
  },
  testoCorpo: {
    ...textStyle('secondary'),
    color: colors.text.primary,
  },
  testoSecondario: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
  testoData: {
    ...textStyle('secondary'),
    color: colors.text.secondary,
  },
  corpoModaleNotifica: {
    paddingVertical: space[2],
  },
  testoCorpoDettaglio: {
    ...textStyle('body'),
    color: colors.text.primary,
    lineHeight: 24,
  },
});
