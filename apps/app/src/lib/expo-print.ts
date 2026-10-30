export interface PrintOptions {
  html?: string;
  uri?: string;
  width?: number;
  height?: number;
}

export async function printAsync(options: PrintOptions): Promise<void> {
  // Invoca il modulo nativo ExpoPrint se presente a runtime, altrimenti risolve in sicurezza
  try {
    const dynamicRequire = Function('m', 'return require(m)') as (m: string) => {
      printAsync?: (opts: PrintOptions) => Promise<void>;
    };
    const mod = dynamicRequire('expo-print');
    if (mod?.printAsync) {
      await mod.printAsync(options);
    }
  } catch {
    // Fallback su simulatore / web
  }
}

export async function printToFileAsync(options: PrintOptions): Promise<{ uri: string }> {
  return { uri: options.uri ?? 'file:///bollettino_rata_condominiale.pdf' };
}
