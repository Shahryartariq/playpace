import type { MetadataRoute } from 'next';
import en from '@/i18n/dictionaries/en';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Playpace: YouTube playlist length calculator',
    short_name: 'Playpace',
    description: en.meta.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F4F5FA',
    theme_color: '#3442F5',
    categories: ['utilities', 'education', 'productivity'],
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { src: '/icon-512.png', type: 'image/png', sizes: '512x512' },
      { src: '/icon-maskable-512.png', type: 'image/png', sizes: '512x512', purpose: 'maskable' },
    ],
  };
}
