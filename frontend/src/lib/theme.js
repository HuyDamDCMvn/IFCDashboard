/**
 * theme.js — Single source of truth for colors, shadows, radii, fonts.
 *
 * Import from here instead of hardcoding hex values in components.
 */

export const COLORS = {
  primary:    "#4f46e5",
  primaryDark:"#4338ca",
  cyan:       "#06b6d4",
  emerald:    "#10b981",
  amber:      "#f59e0b",
  danger:     "#ef4444",
  violet:     "#8b5cf6",
  pink:       "#ec4899",
  teal:       "#14b8a6",
  orange:     "#f97316",
  lime:       "#84cc16",
  rose:       "#e11d48",
  sky:        "#0ea5e9",
  fuchsia:    "#d946ef",
  green:      "#22c55e",

  active:     "#ff6600",
  activeDark: "#cc5200",

  text:       "#1a1a2e",
  textLight:  "#666",
  textMuted:  "#888",
  textFaint:  "#aaa",
  border:     "#e5e7eb",
  borderLight:"#f0f0f0",
  bg:         "#fff",
  bgSubtle:   "#f8f9fb",
  bgScene:    "#eef1f5",
};

export const PALETTE = [
  "#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
  "#84cc16", "#e11d48", "#0ea5e9", "#d946ef", "#22c55e",
  "#a855f7", "#f43f5e", "#3b82f6", "#eab308", "#64748b",
];

export const ACTIVE_COLOR = "#ff6600";

export const SHADOWS = {
  sm:   "0 2px 8px rgba(0,0,0,0.08)",
  md:   "0 4px 12px rgba(0,0,0,0.1)",
  lg:   "0 8px 24px rgba(0,0,0,0.12)",
  xl:   "0 12px 40px rgba(0,0,0,0.15)",
};

export const RADII = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const FONT_SIZES = {
  xs: 10,
  sm: 11,
  md: 12,
  base: 13,
  lg: 14,
  xl: 16,
  xxl: 22,
};
