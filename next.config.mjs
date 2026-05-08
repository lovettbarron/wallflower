import { readFileSync } from 'fs';

const tauriConf = JSON.parse(readFileSync('./crates/wallflower-app/tauri.conf.json', 'utf-8'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_APP_VERSION: tauriConf.version,
  },
};

export default nextConfig;
