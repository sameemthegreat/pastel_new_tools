/**
 * App theme (meta) — the backend-controlled theme the Pastel mobile app applies at launch, with no
 * app release or OTA. Served by `GET /api/v1/meta/theme` and flipped by `PATCH /api/v1/meta/theme`.
 *
 * The value is held in-process on the backend (seeded from the `ACTIVE_THEME` env, resets on restart,
 * single-instance) — it is intentionally NOT a database row. The Expo app reads this on boot via its
 * RemoteThemeGate and layers any `tokens` over the built-in palette.
 */

/** The exact set of themeable tokens the Expo app understands (mirrors pastel-expo `themes.ts`). */
export const THEME_TOKEN_KEYS = [
  "primary",
  "primaryHover",
  "primaryTile",
  "secondary",
  "accent",
  "onSurface",
  "onSurfaceVariant",
  "onSurfaceV2",
  "outlineVariant",
  "containerLow",
  "navInactive",
  "badge",
] as const;

export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];

/** A full token → hex map. The backend/app also accept a partial map (missing keys fall back). */
export type ThemeTokens = Record<ThemeTokenKey, string>;

/** Human labels + short descriptions for each token, so the editor explains what it paints. */
export const THEME_TOKEN_FIELDS: { key: ThemeTokenKey; label: string; hint: string }[] = [
  { key: "primary", label: "Primary", hint: "Brand primary — CTAs, active states, links." },
  { key: "primaryHover", label: "Primary (pressed)", hint: "Pressed/hover shade of primary." },
  { key: "primaryTile", label: "Primary tile", hint: "Soft primary-tinted surface/background." },
  { key: "secondary", label: "Secondary", hint: "Brand secondary / supporting accent." },
  { key: "accent", label: "Accent", hint: "Festive/seasonal accent (badges, highlights)." },
  { key: "onSurface", label: "On surface", hint: "Primary text/icon on surfaces." },
  { key: "onSurfaceVariant", label: "On surface (variant)", hint: "Secondary text/icon." },
  { key: "onSurfaceV2", label: "On surface (muted)", hint: "Tertiary/muted text." },
  { key: "outlineVariant", label: "Outline", hint: "Hairlines, dividers, borders." },
  { key: "containerLow", label: "Container (low)", hint: "Low-emphasis container fill." },
  { key: "navInactive", label: "Nav inactive", hint: "Inactive tab-bar / nav icons." },
  { key: "badge", label: "Badge", hint: "Notification badges + accent links (brand accent)." },
];

/**
 * The built-in palettes the app ships, mirrored from pastel-expo `src/constants/themes.ts`. Used only
 * to seed the custom-palette editor with a sensible starting point — the source of truth is the app.
 */
export const BUILTIN_THEME_TOKENS: Record<string, ThemeTokens> = {
  default: {
    primary: "#E3560A",
    primaryHover: "#c94d09",
    primaryTile: "#FDECE1",
    secondary: "#065a3f",
    accent: "#b8963e",
    onSurface: "#1B1B1B",
    onSurfaceVariant: "#515151",
    onSurfaceV2: "#868686",
    outlineVariant: "#D7D7D7",
    containerLow: "#F5F5F5",
    navInactive: "#8E8E93",
    badge: "#F15A24",
  },
  christmas: {
    primary: "#C1121F",
    primaryHover: "#9E0E19",
    primaryTile: "#F7DDDE",
    secondary: "#1B5E3B",
    accent: "#1B7A44",
    onSurface: "#1B1B1B",
    onSurfaceVariant: "#515151",
    onSurfaceV2: "#868686",
    outlineVariant: "#D7D7D7",
    containerLow: "#F5F5F5",
    navInactive: "#8E8E93",
    badge: "#C1121F",
  },
};

/** `GET /api/v1/meta/theme` → `data.value`. */
export type ThemeConfig = {
  /** The theme name the app applies (e.g. `default`, `christmas`, or a pushed custom name). */
  activeTheme: string;
  /** Token → hex overrides layered on the built-in theme, or `null` to use the built-in tokens. */
  tokens: Record<string, string> | null;
  /** Theme names the app ships — used to render the built-in switcher. */
  availableThemes: string[];
  /** ISO-8601 timestamp of the last theme change on this environment. */
  updatedAt: string;
};

/**
 * `PATCH /api/v1/meta/theme` body — THE object sent to the backend. Send just `{ activeTheme }` to
 * switch between built-in themes (clears overrides), or include `tokens` to push a custom palette.
 */
export type UpdateThemePayload = {
  activeTheme: string;
  tokens?: Record<string, string> | null;
};
