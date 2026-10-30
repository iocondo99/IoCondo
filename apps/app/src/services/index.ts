import { createServices } from '@iocondo/data';
import { supabase } from '../lib/supabase';

export * from '@iocondo/data';

/** Istanza pronta all'uso nelle schermate: `import { services } from '@/services'`. */
export const services = createServices(supabase);
