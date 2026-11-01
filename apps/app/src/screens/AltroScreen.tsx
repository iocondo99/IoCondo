import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { homeDi, navigazioneMobile, type Vista } from '@iocondo/data';
import {
  Button,
  Icon,
  PageHeader,
  Select,
  borderWidths,
  colors,
  radii,
  space,
  textStyle,
  touchTarget,
  useBreakpoint,
  useToast,
} from '@iocondo/ui';
import { NavLink } from '@/components/layout/NavLink';
import { iconaDi } from '@/components/layout/navigation';
import { useAuth } from '@/context/AuthContext';
import { useProfilo } from '@/context/ProfiloContext';

/** "Altro" dello smartphone: le voci che non stanno nella barra, condominio e vista, e "Esci". */
export function AltroScreen() {
  const profilo = useProfilo();
  const { signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { breakpoint } = useBreakpoint();
  const altre = profilo.vista ? navigazioneMobile(profilo.voci, profilo.vista).altre : [];
  const condomini = profilo.profilo?.condomini ?? [];

  const cambiaVista = (valore: string) => {
    const vista = valore as Vista;
    profilo.setVista(vista);
    router.replace(homeDi(vista) as Href);
  };

  return (
    <>
      <PageHeader
        title="Altro"
        subtitle={profilo.etichettaVista ? `Accesso come ${profilo.etichettaVista.toLowerCase()}.` : undefined}
      />
      {condomini.length > 1 ? (
        <Select
          label="Condominio"
          value={profilo.condominio?.id ?? null}
          options={condomini.map((c) => ({ value: c.id, label: c.nome }))}
          onChange={profilo.setCondominioId}
        />
      ) : null}
      {profilo.viste.length > 1 ? (
        <Select
          label="Vista"
          value={profilo.vista}
          options={profilo.viste.map((v) => ({ value: v, label: profilo.etichettaDi(v) }))}
          onChange={cambiaVista}
        />
      ) : null}
      {altre.length > 0 ? (
        <View role="list" style={styles.lista}>
          {altre.map((voce) => (
            <View key={voce.id} role="listitem">
              <NavLink
                href={voce.route}
                label={voce.label}
                active={false}
                style={styles.riga}
                hoverStyle={styles.rigaHover}
                focusStyle={styles.rigaFocus}
              >
                <Icon name={iconaDi(voce)} size="menu" color={colors.brand.navy} />
                <Text style={[textStyle('body', breakpoint), styles.testo]}>{voce.label}</Text>
                <Icon name="chevron-right" size="action" color={colors.text.muted} />
              </NavLink>
            </View>
          ))}
        </View>
      ) : null}
      <Button
        variant="secondary"
        label="Esci dall’account"
        icon="log-out"
        fullWidth
        onPress={async () => {
          const esito = await signOut();
          if (!esito.ok) toast.show({ tone: 'error', message: esito.message });
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  lista: {
    backgroundColor: colors.surface,
    borderWidth: borderWidths.thin,
    borderColor: colors.border,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  riga: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: touchTarget.comfortable,
    paddingHorizontal: space[4],
    borderWidth: borderWidths.thin,
    borderColor: 'transparent',
  },
  rigaHover: { backgroundColor: colors.background },
  rigaFocus: { borderColor: colors.focus },
  testo: { flex: 1, color: colors.text.primary },
});
