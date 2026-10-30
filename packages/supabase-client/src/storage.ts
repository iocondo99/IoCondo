/**
 * Storage della sessione Supabase per piattaforma:
 * - web: localStorage (se assente, es. rendering server, sessione solo in memoria);
 * - iOS / Android: AsyncStorage.
 *
 * Sta in un entry point separato (`@iocondo/supabase-client/storage`) perche' l'import di
 * AsyncStorage non deve finire nel bundle di chi usa solo il client browser (admin-web).
 * `@react-native-async-storage/async-storage` e' una peerDependency opzionale, caricata solo su nativo.
 */
export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// globalThis tipizzato a mano: i consumer nativi non hanno la lib DOM
const g = globalThis as { document?: unknown; localStorage?: SessionStorageSync };
interface SessionStorageSync {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isWeb = typeof g.document !== 'undefined';

function createWebStorage(): SessionStorage {
  const memory = new Map<string, string>();
  const ls = (): SessionStorageSync | null => {
    try {
      return g.localStorage ?? null;
    } catch {
      return null; // accesso negato (es. blocco dati del sito)
    }
  };
  return {
    async getItem(key) {
      const store = ls();
      return store ? store.getItem(key) : (memory.get(key) ?? null);
    },
    async setItem(key, value) {
      const store = ls();
      if (store) store.setItem(key, value);
      else memory.set(key, value);
    },
    async removeItem(key) {
      const store = ls();
      if (store) store.removeItem(key);
      else memory.delete(key);
    },
  };
}

function createNativeStorage(): SessionStorage {
  // require lazy: su web questo ramo non viene mai eseguito
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-async-storage/async-storage') as { default: SessionStorage };
  return mod.default;
}

export const platformStorage: SessionStorage = isWeb ? createWebStorage() : createNativeStorage();
