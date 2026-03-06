/**
 * shared-styles.js — Reusable style objects for common UI patterns.
 *
 * Reduces inline style duplication across components.
 */

import { SHADOWS, RADII, COLORS } from "./theme";

export const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

export const modalContainer = (width = "92vw", maxWidth = 1200) => ({
  background: COLORS.bg,
  borderRadius: RADII.xl,
  boxShadow: SHADOWS.xl,
  width,
  maxWidth,
  maxHeight: "90vh",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
});

export const dropdownMenu = {
  position: "absolute",
  top: "100%",
  left: 0,
  marginTop: 4,
  background: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADII.lg,
  boxShadow: SHADOWS.lg,
  zIndex: 100,
  maxHeight: 320,
  overflowY: "auto",
  minWidth: 260,
  padding: "6px 0",
};

export const badge = (bg = "#eef2ff", color = COLORS.primaryDark) => ({
  fontSize: 11,
  fontWeight: 600,
  background: bg,
  color,
  padding: "3px 10px",
  borderRadius: RADII.full,
  letterSpacing: 0.5,
});

export const tooltipBox = {
  borderRadius: RADII.md,
  border: `1px solid ${COLORS.borderLight}`,
  boxShadow: SHADOWS.md,
};

export const pillButton = (active = false, accentBg = "#eef2ff", accentBorder = COLORS.primary) => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 500,
  background: active ? accentBg : COLORS.bg,
  border: `1.5px solid ${active ? accentBorder : "#d1d5db"}`,
  borderRadius: RADII.md,
  cursor: "pointer",
  color: COLORS.text,
});

export const countBadge = (bg = COLORS.primary) => ({
  background: bg,
  color: "#fff",
  borderRadius: RADII.lg,
  padding: "1px 7px",
  fontSize: 11,
  fontWeight: 700,
});

export const resetButton = {
  padding: "5px 12px",
  borderRadius: RADII.md - 2,
  border: "1px solid #d1d5db",
  background: COLORS.bg,
  color: COLORS.textLight,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.15s",
};
