import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  validaNuovoCondominioEAdmin,
  type ErroriNuovoCondominioAdmin,
} from '@iocondo/data';
import {
  Alert,
  Breadcrumbs,
  Button,
  Card,
  Input,
  PageHeader,
  colors,
  space,
  textStyle,
  useBreakpoint,
  useToast,
} from '@iocondo/ui';
import { useAccessoConsentito } from '@/components/layout/GuardiaVista';
import { useProfilo } from '@/context/ProfiloContext';
import { services } from '@/services';

export function SuperAdminNuovoCondominioScreen() {
  const consentito = useAccessoConsentito();
  const { profilo } = useProfilo();
  if (!consentito || !profilo?.isSuperAdmin) return null;
  return <SuperAdminNuovoCondominioContenuto superAdminId={profilo.id} />;
}

function SuperAdminNuovoCondominioContenuto({ superAdminId }: { superAdminId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { isDesktop } = useBreakpoint();

  const [nomeCondominio, setNomeCondominio] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [citta, setCitta] = useState('');
  const [cap, setCap] = useState('');
  const [provincia, setProvincia] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');

  const [adminEmail, setAdminEmail] = useState('');
  const [adminNomeCognome, setAdminNomeCognome] = useState('');
  const [adminTelefono, setAdminTelefono] = useState('');

  const [errori, setErrori] = useState<ErroriNuovoCondominioAdmin>({});
  const [erroreServer, setErroreServer] = useState<string | null>(null);
  const [salvataggio, setSalvataggio] = useState(false);

  const handleCrea = async () => {
    setErroreServer(null);
    const input = {
      nomeCondominio,
      indirizzo,
      citta,
      cap,
      provincia,
      codiceFiscale,
      adminEmail,
      adminNomeCognome,
      adminTelefono,
    };
    const err = validaNuovoCondominioEAdmin(input);
    if (err) {
      setErrori(err);
      return;
    }
    setErrori({});
    setSalvataggio(true);
    try {
      const res = await services.superadmin.creaCondominioEAssegnaAdmin(superAdminId, input);
      toast.show({ tone: 'success', message: res.messaggio });
      router.replace('/superadmin/amministratori');
    } catch (e: unknown) {
      setErroreServer(
        e instanceof Error ? e.message : 'Non è stato possibile creare il condominio.',
      );
    } finally {
      setSalvataggio(false);
    }
  };

  return (
    <View style={styles.pagina}>
      <Breadcrumbs
        items={[
          { label: 'Super Admin', onPress: () => router.push('/superadmin/amministratori') },
          { label: 'Amministratori', onPress: () => router.push('/superadmin/amministratori') },
          { label: 'Nuovo condominio' },
        ]}
      />

      <PageHeader
        title="Nuovo condominio"
        subtitle="Inserisci i dati del condominio e quelli dell'amministratore: se è già registrato viene collegato subito, altrimenti parte l'invito."
      />

      {erroreServer ? <Alert tone="error" message={erroreServer} /> : null}

      <Card title="Dati del condominio">
        <View style={styles.form}>
          <Text style={[textStyle('secondary'), styles.sottotitoloCard]}>
            Informazioni anagrafiche principali dell&apos;edificio o complesso.
          </Text>
          <Input
            label="Nome condominio *"
            value={nomeCondominio}
            onChangeText={(v) => {
              setNomeCondominio(v);
              if (errori.nomeCondominio) setErrori((p) => ({ ...p, nomeCondominio: undefined }));
            }}
            placeholder="Es. Condominio Parco delle Rose"
            error={errori.nomeCondominio}
          />

          <Input
            label="Indirizzo *"
            value={indirizzo}
            onChangeText={(v) => {
              setIndirizzo(v);
              if (errori.indirizzo) setErrori((p) => ({ ...p, indirizzo: undefined }));
            }}
            placeholder="Es. Via delle Rose 14"
            error={errori.indirizzo}
          />

          <View style={isDesktop ? styles.rigaDesktop : styles.colonnaMobile}>
            <View style={styles.campoFlessibile}>
              <Input
                label="Città *"
                value={citta}
                onChangeText={(v) => {
                  setCitta(v);
                  if (errori.citta) setErrori((p) => ({ ...p, citta: undefined }));
                }}
                placeholder="Es. Roma"
                error={errori.citta}
              />
            </View>
            <View style={styles.campoCorto}>
              <Input
                label="CAP"
                value={cap}
                onChangeText={setCap}
                placeholder="00100"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <View style={styles.campoCorto}>
              <Input
                label="Provincia"
                value={provincia}
                onChangeText={(v) => {
                  setProvincia(v);
                  if (errori.provincia) setErrori((p) => ({ ...p, provincia: undefined }));
                }}
                placeholder="RM"
                autoCapitalize="characters"
                maxLength={2}
                error={errori.provincia}
              />
            </View>
          </View>

          <Input
            label="Codice fiscale condominio (opzionale)"
            value={codiceFiscale}
            onChangeText={setCodiceFiscale}
            placeholder="Es. 97012340581"
            autoCapitalize="characters"
            maxLength={16}
          />
        </View>
      </Card>

      <Card title="Amministratore del condominio">
        <View style={styles.form}>
          <Text style={[textStyle('secondary'), styles.sottotitoloCard]}>
            Se l&apos;indirizzo email è già presente nel database, il condominio viene associato subito senza inviare un nuovo invito.
          </Text>
          <Input
            label="Email amministratore *"
            value={adminEmail}
            onChangeText={(v) => {
              setAdminEmail(v);
              if (errori.adminEmail) setErrori((p) => ({ ...p, adminEmail: undefined }));
            }}
            placeholder="amministratore@studio.it"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errori.adminEmail}
          />

          <View style={isDesktop ? styles.rigaDesktop : styles.colonnaMobile}>
            <View style={styles.campoFlessibile}>
              <Input
                label="Nome e cognome *"
                value={adminNomeCognome}
                onChangeText={(v) => {
                  setAdminNomeCognome(v);
                  if (errori.adminNomeCognome) {
                    setErrori((p) => ({ ...p, adminNomeCognome: undefined }));
                  }
                }}
                placeholder="Es. Studio Mario Rossi"
                error={errori.adminNomeCognome}
              />
            </View>
            <View style={styles.campoFlessibile}>
              <Input
                label="Telefono (opzionale)"
                value={adminTelefono}
                onChangeText={setAdminTelefono}
                placeholder="+39 06 1234567"
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>
      </Card>

      <View style={styles.azioni}>
        <Button
          variant="secondary"
          label="Annulla"
          onPress={() => router.back()}
          disabled={salvataggio}
        />
        <Button
          variant="primary"
          icon="building-2"
          label="Crea condominio"
          onPress={() => void handleCrea()}
          loading={salvataggio}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    alignSelf: 'stretch',
    gap: space[6],
  },
  form: {
    gap: space[4],
  },
  sottotitoloCard: {
    color: colors.text.secondary,
  },
  rigaDesktop: {
    flexDirection: 'row',
    gap: space[4],
  },
  colonnaMobile: {
    gap: space[4],
  },
  campoFlessibile: {
    flex: 2,
  },
  campoCorto: {
    flex: 1,
  },
  azioni: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space[3],
  },
});
