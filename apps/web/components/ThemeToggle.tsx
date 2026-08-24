'use client';

import { useEffect, useState } from 'react';

import { COLOR_MODE_STORAGE_KEY, nextColorMode, type ColorMode } from '@/lib/theme';

function applyColorMode(mode: ColorMode) {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<ColorMode>('light');

  useEffect(() => {
    setMode(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  function handleToggle() {
    const updatedMode = nextColorMode(mode);
    applyColorMode(updatedMode);
    setMode(updatedMode);

    try {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, updatedMode);
    } catch {
      // The theme still works for this visit when storage is unavailable.
    }
  }

  const darkModeActive = mode === 'dark';
  const label = darkModeActive ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={label}
      aria-pressed={darkModeActive}
      title={label}
      className="theme-toggle flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white text-ink shadow-pop-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
    >
      {darkModeActive ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
    </button>
  );
}
