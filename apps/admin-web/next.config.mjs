import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@iocondo/shared-types', '@iocondo/supabase-client'],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'lucide-react': path.resolve(__dirname, 'src/lib/lucide-react.tsx'),
    };
    return config;
  },
};

export default nextConfig;
