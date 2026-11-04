'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { themeStore, type ThemeChoice } from '@/lib/storage';

interface Props {
  labels: { theme: string; light: string; dark: string; system: string };
}

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };

function Icon({ choice }: { choice: ThemeChoice }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  if (choice === 'light') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4" {...common} />
        <path {...common} d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (choice === 'dark') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path {...common} d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" {...common} />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" />
    </svg>
  );
}

/** Cycles device → light → dark. The choice is saved in this browser and applied before paint by the layout. */
export function ThemeToggle({ labels }: Props) {
  const choice = useSyncExternalStore(themeStore.subscribe, themeStore.read, themeStore.server);

  useEffect(() => {
    const root = document.documentElement;
    if (choice === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', choice);
  }, [choice]);

  const name = labels[choice];
  return (
    <button
      type="button"
      className="icon-button"
      onClick={() => themeStore.write(NEXT[choice])}
      aria-label={`${labels.theme}: ${name}`}
      title={`${labels.theme}: ${name}`}
    >
      <Icon choice={choice} />
    </button>
  );
}
