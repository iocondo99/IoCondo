import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../tokens';
import { DatePicker } from './DatePicker';
import { Select, type SelectOption } from './Select';
import { useTextStyle } from './internal';

export interface DateTimePickerProps {
  /** Sempre visibile sopra i campi. */
  label: string;
  /** Data e ora come testo locale "AAAA-MM-GGTHH:mm", o stringa vuota. */
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** Passo dei minuti nella scelta dell'ora (predefinito 15). */
  minuteStep?: number;
}

const due = (n: number) => String(n).padStart(2, '0');

function separa(value: string): { data: Date | null; ora: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec((value || '').trim());
  if (!m) return { data: null, ora: '' };
  return {
    data: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
    ora: m[4] && m[5] ? `${m[4]}:${m[5]}` : '',
  };
}

function unisci(data: Date | null, ora: string): string {
  if (!data) return '';
  const giorno = `${data.getFullYear()}-${due(data.getMonth() + 1)}-${due(data.getDate())}`;
  return `${giorno}T${ora || '00:00'}`;
}

/**
 * Data e ora insieme: data in formato italiano (gg/mm/aaaa) con calendario, ora scelta da un
 * elenco ricercabile (si puo' scrivere "18" per trovare le ore 18). Il valore resta "AAAA-MM-GGTHH:mm".
 */
export function DateTimePicker({
  label,
  value,
  onChange,
  helperText,
  error,
  required,
  disabled = false,
  minuteStep = 15,
}: DateTimePickerProps) {
  const labelStyle = useTextStyle('label');
  const supportStyle = useTextStyle('secondary');
  const { data, ora } = separa(value);

  const opzioniOra: SelectOption[] = React.useMemo(() => {
    const passo = Math.max(1, Math.min(60, minuteStep));
    const lista: SelectOption[] = [];
    for (let h = 0; h < 24; h += 1) {
      for (let m = 0; m < 60; m += passo) {
        const t = `${due(h)}:${due(m)}`;
        lista.push({ value: t, label: t });
      }
    }
    // Un orario gia' salvato fuori dal passo resta selezionabile.
    if (ora && !lista.some((o) => o.value === ora)) {
      lista.push({ value: ora, label: ora });
      lista.sort((a, b) => a.value.localeCompare(b.value));
    }
    return lista;
  }, [minuteStep, ora]);

  return (
    <View style={styles.root}>
      <Text style={[labelStyle, { color: colors.text.primary }]}>
        {label}
        {required ? <Text style={{ color: colors.text.secondary }}> (obbligatorio)</Text> : null}
      </Text>
      <View style={styles.riga}>
        <View style={styles.data}>
          <DatePicker
            label={`${label}: data`}
            hideLabel
            helperText=""
            value={data}
            onChange={(d) => onChange(unisci(d, ora))}
            disabled={disabled}
          />
        </View>
        <View style={styles.ora}>
          <Select
            label={`${label}: ora`}
            hideLabel
            options={opzioniOra}
            value={ora || null}
            placeholder="Ora"
            onChange={(o) => onChange(unisci(data ?? new Date(), o))}
            disabled={disabled}
            floating
          />
        </View>
      </View>
      {error ? (
        <Text style={[supportStyle, { color: colors.semantic.error.foreground }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[supportStyle, { color: colors.text.secondary }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', gap: space[2] },
  riga: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space[2] },
  // La data tiene sempre lo spazio per gg/mm/aaaa e l'icona del calendario.
  data: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 170 },
  ora: { flexGrow: 0, flexShrink: 0, width: 116 },
});
