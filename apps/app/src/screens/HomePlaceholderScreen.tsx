import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Alert, Button, PageHeader, colors, layout, space, textStyle, useBreakpoint } from '@iocondo/ui';
import { useAuth } from '@/context/AuthContext';

/** Segnaposto di "/" finché la Home vera non è pronta: titolo, spiegazione e "Esci". */
export function HomePlaceholderScreen() {
  const { user, signOut } = useAuth();
  const { breakpoint } = useBreakpoint();
  const [failure, setFailure] = useState<string | null>(null);

  const exit = async () => {
    setFailure(null);
    const result = await signOut();
    // Se l'uscita riesce la guardia porta alla pagina di accesso.
    if (!result.ok) setFailure(result.message);
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <PageHeader title="Home" />
        <Text style={[textStyle('body', breakpoint), styles.text]}>
          La tua schermata principale è in arrivo. Intanto sei collegato e puoi uscire in sicurezza.
        </Text>
        {user?.email ? (
          <Text style={[textStyle('secondary', breakpoint), styles.text]}>{`Accesso effettuato come ${user.email}.`}</Text>
        ) : null}
        {failure ? <Alert tone="error" message={failure} /> : null}
        <Button variant="secondary" label="Esci" loadingLabel="Uscita in corso…" icon="arrow-right" onPress={exit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, alignItems: 'center', padding: space[4] },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, gap: space[4], paddingTop: space[8] },
  text: { color: colors.text.secondary },
});
