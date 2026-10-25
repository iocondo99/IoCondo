/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // I workspace sono TypeScript sorgente: Next deve transpilarli
  transpilePackages: ['@iocondo/shared-types', '@iocondo/supabase-client'],
};

export default nextConfig;
