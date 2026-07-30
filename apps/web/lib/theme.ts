// Daily theme rotation: one palette per day of the week, applied via CSS
// custom properties before hydration (see layout.tsx). Tailwind's primary/*
// and accent/* colors resolve to these variables, so the whole app retints.

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export interface DailyTheme {
  name: string;
  emoji: string;
  vars: Record<string, string>; // CSS var name -> "r g b" triplet
}

function theme(
  name: string,
  emoji: string,
  primary: [string, string, string, string, string, string, string], // 50,100,200,500,600,700,900
  accent: [string, string, string], // 400,500,600
  bg: string
): DailyTheme {
  const [p50, p100, p200, p500, p600, p700, p900] = primary;
  const [a400, a500, a600] = accent;
  return {
    name, emoji,
    vars: {
      '--p-50': rgb(p50), '--p-100': rgb(p100), '--p-200': rgb(p200),
      '--p-500': rgb(p500), '--p-600': rgb(p600), '--p-700': rgb(p700), '--p-900': rgb(p900),
      '--a-400': rgb(a400), '--a-500': rgb(a500), '--a-600': rgb(a600),
      '--c-bg': rgb(bg),
    },
  };
}

// Indexed by Date.getDay(): 0 = Sunday.
export const THEMES: DailyTheme[] = [
  theme('Grape Soda', '🍇',
    ['#faf5ff', '#f3e8ff', '#e9d5ff', '#a855f7', '#9333ea', '#7e22ce', '#581c87'],
    ['#f472b6', '#ec4899', '#db2777'], '#faf7ff'),
  theme('Blue Raspberry', '🫐',
    ['#eff6ff', '#dbeafe', '#bfdbfe', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a'],
    ['#fb923c', '#f97316', '#ea580c'], '#f0f7ff'),
  theme('Matcha Rush', '🍵',
    ['#ecfdf5', '#d1fae5', '#a7f3d0', '#10b981', '#059669', '#047857', '#064e3b'],
    ['#fbbf24', '#f59e0b', '#d97706'], '#f0fdf6'),
  theme('Cherry Bomb', '🍒',
    ['#fff1f2', '#ffe4e6', '#fecdd3', '#f43f5e', '#e11d48', '#be123c', '#881337'],
    ['#a78bfa', '#8b5cf6', '#7c3aed'], '#fff5f6'),
  theme('Ocean Rave', '🌊',
    ['#ecfeff', '#cffafe', '#a5f3fc', '#06b6d4', '#0891b2', '#0e7490', '#164e63'],
    ['#e879f9', '#d946ef', '#c026d3'], '#f0fbff'),
  theme('Sunset Shift', '🌇',
    ['#fff7ed', '#ffedd5', '#fed7aa', '#f97316', '#ea580c', '#c2410c', '#7c2d12'],
    ['#818cf8', '#6366f1', '#4f46e5'], '#fff8f0'),
  theme('Neon Nights', '💜',
    ['#fdf4ff', '#fae8ff', '#f5d0fe', '#d946ef', '#c026d3', '#a21caf', '#701a75'],
    ['#22d3ee', '#06b6d4', '#0891b2'], '#fdf4ff'),
];

export function getDailyTheme(date = new Date()): DailyTheme {
  return THEMES[date.getDay()];
}

// Inline script injected in <head> — applies today's vars before first paint
// using the visitor's local day, so static pages stay theme-correct.
export function themeInitScript(): string {
  const varsByDay = THEMES.map(t => t.vars);
  return `(function(){var v=${JSON.stringify(varsByDay)}[new Date().getDay()];for(var k in v)document.documentElement.style.setProperty(k,v[k]);})();`;
}
