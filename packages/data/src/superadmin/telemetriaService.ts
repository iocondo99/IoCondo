import type { TypedSupabaseClient } from '@iocondo/supabase-client';
import { normalizzaRispostaTelemetria, type DashboardTelemetriaData } from './telemetriaLogic';

interface RpcCompatClient {
  rpc: (
    fn: string,
    params?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
}

export function createTelemetriaService(db: TypedSupabaseClient) {
  return {
    async getDashboardMetriche(ore = 24): Promise<DashboardTelemetriaData> {
      const rpcDb = db as unknown as RpcCompatClient;
      const { data, error } = await rpcDb.rpc('get_superadmin_dashboard_metriche', {
        p_ore: ore,
      });

      if (error) {
        const msg = error.message ?? 'Errore nel caricamento delle metriche di telemetria.';
        if (
          msg.includes('get_superadmin_dashboard_metriche') &&
          (msg.includes('Could not find') || msg.includes('does not exist'))
        ) {
          throw new Error(
            'Funzione telemetria non ancora installata sul database: applicare supabase/da-applicare/15_telemetria_superadmin.sql.',
          );
        }
        throw new Error(msg);
      }

      return normalizzaRispostaTelemetria(data);
    },
  };
}

export type TelemetriaService = ReturnType<typeof createTelemetriaService>;
