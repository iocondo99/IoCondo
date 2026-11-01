import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { ServiceError } from '@iocondo/supabase-client';
import {
  INVITO_REGISTRATO_MESSAGE,
  etichettaRuoloInvito,
  messaggioErroreInvito,
  ruoliInvitabili,
  statoInvito,
  validateEmail,
  type RigaInvito,
  type RuoloInvitabile,
} from '@iocondo/data';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  PageHeader,
  ResponsiveDataView,
  Select,
  formatDate,
  space,
  type DataColumn,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { useBlocco } from '@/hooks/useBlocco';
import { services } from '@/services';

const NESSUNA_UNITA = '';

/**
 * "Invita una persona" (amministratore). Il condominio è quello scelto nel selettore dell'header. L'invio
 * passa dalla Edge Function: permessi, ruoli e unità li controlla il database. La risposta è la stessa se la
 * persona ha già un account o no ("Invito registrato"), così non si rivela chi è già registrato.
 */
export function InvitiScreen() {
  const consentito = useAccessoConsentito();
  const { profilo, condominio } = useProfilo();
  if (!consentito || !profilo || !condominio) return null;
  return <InvitiContenuto />;
}

function InvitiContenuto() {
  const { profilo, condominio } = useProfilo();
  const condominioId = condominio?.id ?? '';
  const ruoliDisponibili = ruoliInvitabili(profilo?.isSuperAdmin === true);

  const [email, setEmail] = useState('');
  const [ruolo, setRuolo] = useState<RuoloInvitabile>('CONDOMINO');
  const [unitaId, setUnitaId] = useState(NESSUNA_UNITA);
  const [portiere, setPortiere] = useState(false);
  const [toccato, setToccato] = useState(false);
  const [inviato, setInviato] = useState(false);
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // Il blocco sul ref impedisce il doppio invio anche con Invio premuto due volte prima del render.
  const bloccato = useRef(false);
  const emailRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const unita = useBlocco(() => services.inviti.listUnita(condominioId), condominioId);
  const elenco = useBlocco(() => services.inviti.list(condominioId), condominioId);

  const erroreEmail = toccato ? validateEmail(email) : undefined;

  const opzioniUnita = useMemo(
    () => [
      { value: NESSUNA_UNITA, label: 'Nessuna unità in particolare' },
      ...(unita.blocco.stato === 'pronto' ? unita.blocco.dati.map((u) => ({ value: u.id, label: u.etichetta })) : []),
    ],
    [unita.blocco],
  );
  const etichettaUnitaDi = useMemo(() => {
    const mappa = new Map<string, string>();
    if (unita.blocco.stato === 'pronto') for (const u of unita.blocco.dati) mappa.set(u.id, u.etichetta);
    return mappa;
  }, [unita.blocco]);

  const invia = async () => {
    if (bloccato.current) return;
    setInviato(false);
    setErrore(null);
    setToccato(true);
    if (validateEmail(email)) {
      emailRef.current?.focus();
      return;
    }
    bloccato.current = true;
    setOccupato(true);
    try {
      await services.inviti.invia({
        email: email.trim(),
        ruolo,
        condominioId,
        unitaId: unitaId === NESSUNA_UNITA ? null : unitaId,
        flagPortiere: ruolo === 'CONDOMINO' && portiere,
      });
      // Solo ora, a risposta del server arrivata, si conferma e si ricomincia dal modulo vuoto.
      setInviato(true);
      setEmail('');
      setToccato(false);
      setPortiere(false);
      setUnitaId(NESSUNA_UNITA);
      elenco.ricarica();
    } catch (e) {
      setErrore(messaggioErroreInvito(e instanceof ServiceError ? e.code : null));
    } finally {
      bloccato.current = false;
      setOccupato(false);
    }
  };

  const adesso = new Date();
  const colonne: DataColumn<RigaInvito>[] = [
    { key: 'email', header: 'Email', cell: (r) => r.email, minWidth: 220, weight: 2, mobile: 'title' },
    { key: 'ruolo', header: 'Ruolo', cell: (r) => etichettaRuoloInvito(r.ruolo, r.flagPortiere), minWidth: 160 },
    {
      key: 'unita',
      header: 'Unità',
      cell: (r) => (r.unitaId ? (etichettaUnitaDi.get(r.unitaId) ?? '—') : '—'),
      minWidth: 160,
    },
    { key: 'scadenza', header: 'Scade il', cell: (r) => formatDate(r.scadenza), minWidth: 130 },
    { key: 'stato', header: 'Stato', cell: (r) => <Badge status={statoInvito(r, adesso)} />, minWidth: 140, mobile: 'status' },
  ];

  return (
    <View style={styles.pagina}>
      <PageHeader
        title="Invita una persona"
        subtitle={`Condominio: ${condominio?.nome ?? ''}. Le mandiamo un’email per scegliere la password.`}
      />

      <Card title="Nuovo invito">
        <View role="form" aria-label="Nuovo invito" style={styles.form}>
          {inviato ? <Alert tone="success" message={INVITO_REGISTRATO_MESSAGE} persistent /> : null}
          {errore ? <Alert tone="error" message={errore} persistent /> : null}

          <Input
            label="Email della persona"
            value={email}
            onChangeText={setEmail}
            onBlur={() => setToccato(true)}
            error={erroreEmail}
            inputRef={emailRef}
            placeholder="nome@esempio.it"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={() => void invia()}
            disabled={occupato}
          />
          <Select
            label="Ruolo"
            options={ruoliDisponibili.map((r) => ({ value: r, label: etichettaRuoloInvito(r, false) }))}
            value={ruolo}
            onChange={(valore) => setRuolo(valore as RuoloInvitabile)}
            disabled={occupato}
          />
          <Select
            label="Unità (facoltativa)"
            options={opzioniUnita}
            value={unitaId}
            onChange={setUnitaId}
            helperText={
              unita.blocco.stato === 'errore'
                ? 'Non siamo riusciti a caricare le unità. Puoi invitare senza sceglierne una.'
                : 'Scegline una se la persona abita o possiede un’unità precisa.'
            }
            disabled={occupato}
          />
          {ruolo === 'CONDOMINO' ? (
            <Checkbox
              checked={portiere}
              onChange={setPortiere}
              label="È anche portiere"
              helperText="Vedrà anche il registro pacchi e i ticket delle aree comuni."
              disabled={occupato}
            />
          ) : null}

          <Button label="Invia invito" loadingLabel="Invio in corso…" loading={occupato} onPress={invia} />
        </View>
      </Card>

      <Card title="Inviti inviati">
        <ResponsiveDataView
          label="Inviti inviati"
          columns={colonne}
          rows={elenco.blocco.stato === 'pronto' ? elenco.blocco.dati : []}
          getRowKey={(r) => `${r.email}|${r.ruolo}|${r.unitaId ?? ''}|${r.scadenza}`}
          getRowLabel={(r) => `Invito a ${r.email}`}
          loading={elenco.blocco.stato === 'caricamento'}
          error={elenco.blocco.stato === 'errore'}
          onRetry={elenco.ricarica}
          empty={{
            title: 'Non hai ancora invitato nessuno',
            description: 'Gli inviti che mandi compaiono qui, con il loro stato.',
          }}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { gap: space[6] },
  form: { gap: space[5] },
});
