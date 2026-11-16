// src/lib/tagColors.ts
// Sistema de colores estilo Notion y soporte para selector de color libre (HEX)

export interface TagColorDef {
  id: string;
  label: string;
  badgeClass: string;
  avatarBg: string;
  dotBg: string;
  previewRing: string;
  customHex?: string;
}

export function isLightHex(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16) || 0;
  const g = parseInt(c.substring(2, 4), 16) || 0;
  const b = parseInt(c.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160;
}

export function buildCustomHexColorDef(hex: string): TagColorDef {
  let cleanHex = hex.trim();
  if (!cleanHex.startsWith('#')) cleanHex = `#${cleanHex}`;
  return {
    id: cleanHex.toLowerCase(),
    label: `Personalizado (${cleanHex.toUpperCase()})`,
    badgeClass: '',
    avatarBg: '',
    dotBg: '',
    previewRing: '',
    customHex: cleanHex,
  };
}

export const TAG_COLOR_OPTIONS: TagColorDef[] = [
  {
    id: 'blue',
    label: 'Azul Notion',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/70',
    avatarBg: 'bg-blue-600 text-white',
    dotBg: 'bg-blue-500',
    previewRing: 'ring-blue-500',
    customHex: '#2563eb',
  },
  {
    id: 'purple',
    label: 'Púrpura / Violeta',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/70',
    avatarBg: 'bg-purple-600 text-white',
    dotBg: 'bg-purple-500',
    previewRing: 'ring-purple-500',
    customHex: '#9333ea',
  },
  {
    id: 'emerald',
    label: 'Esmeralda / Verde',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70',
    avatarBg: 'bg-emerald-600 text-white',
    dotBg: 'bg-emerald-500',
    previewRing: 'ring-emerald-500',
    customHex: '#059669',
  },
  {
    id: 'amber',
    label: 'Ámbar / Amarillo',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70',
    avatarBg: 'bg-amber-500 text-neutral-950',
    dotBg: 'bg-amber-500',
    previewRing: 'ring-amber-500',
    customHex: '#d97706',
  },
  {
    id: 'orange',
    label: 'Naranja / Coral',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/70',
    avatarBg: 'bg-orange-600 text-white',
    dotBg: 'bg-orange-500',
    previewRing: 'ring-orange-500',
    customHex: '#ea580c',
  },
  {
    id: 'rose',
    label: 'Rosa / Frambuesa',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/70',
    avatarBg: 'bg-rose-600 text-white',
    dotBg: 'bg-rose-500',
    previewRing: 'ring-rose-500',
    customHex: '#e11d48',
  },
  {
    id: 'indigo',
    label: 'Índigo / Marino',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/70',
    avatarBg: 'bg-indigo-600 text-white',
    dotBg: 'bg-indigo-500',
    previewRing: 'ring-indigo-500',
    customHex: '#4f46e5',
  },
  {
    id: 'cyan',
    label: 'Cian / Turquesa',
    badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800/70',
    avatarBg: 'bg-cyan-600 text-white',
    dotBg: 'bg-cyan-500',
    previewRing: 'ring-cyan-500',
    customHex: '#0891b2',
  },
  {
    id: 'fuchsia',
    label: 'Fucsia / Magenta',
    badgeClass: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-950/50 dark:text-fuchsia-300 dark:border-fuchsia-800/70',
    avatarBg: 'bg-fuchsia-600 text-white',
    dotBg: 'bg-fuchsia-500',
    previewRing: 'ring-fuchsia-500',
    customHex: '#c026d3',
  },
  {
    id: 'neutral',
    label: 'Grafito / Neutro',
    badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700',
    avatarBg: 'bg-neutral-700 dark:bg-neutral-300 text-white dark:text-neutral-900',
    dotBg: 'bg-neutral-500',
    previewRing: 'ring-neutral-500',
    customHex: '#525252',
  },
];

// Obtener mapa de colores guardados en localStorage
export function getSavedUserColors(): Record<string, string> {
  try {
    const raw = localStorage.getItem('woof_user_colors');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Guardar color de usuario localmente y notificar a la app
export function saveLocalUserColor(identifier: string, colorId: string): void {
  try {
    const current = getSavedUserColors();
    const cleanKey = identifier.trim().toLowerCase();
    current[cleanKey] = colorId;
    localStorage.setItem('woof_user_colors', JSON.stringify(current));
    
    window.dispatchEvent(
      new CustomEvent('woof_color_updated', {
        detail: { identifier: cleanKey, colorId },
      })
    );
  } catch {}
}

// Generador de color determinista a partir del nombre
function hashColorIndex(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % TAG_COLOR_OPTIONS.length;
}

// Obtener la definición de estilo según colorId o nombre
export function getTagColorDef(
  identifier?: string,
  preferredColorId?: string
): TagColorDef {
  const safeIdentifier = (identifier || '').trim();
  const cleanKey = safeIdentifier.toLowerCase();

  // 1. Si se le pasó explícitamente un colorId válido
  if (preferredColorId) {
    if (preferredColorId.startsWith('#')) {
      return buildCustomHexColorDef(preferredColorId);
    }
    const found = TAG_COLOR_OPTIONS.find((c) => c.id === preferredColorId);
    if (found) return found;
  }

  // 2. Si el identificador tiene un color en localStorage
  if (cleanKey) {
    const savedColors = getSavedUserColors();
    const savedId = savedColors[cleanKey];
    if (savedId) {
      if (savedId.startsWith('#')) {
        return buildCustomHexColorDef(savedId);
      }
      const found = TAG_COLOR_OPTIONS.find((c) => c.id === savedId);
      if (found) return found;
    }
  }

  // 3. Fallback armónico determinista basado en el nombre
  if (safeIdentifier) {
    const idx = hashColorIndex(safeIdentifier);
    return TAG_COLOR_OPTIONS[idx];
  }

  // 4. Fallback por defecto: Azul
  return TAG_COLOR_OPTIONS[0];
}
