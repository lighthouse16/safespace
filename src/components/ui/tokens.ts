/**
 * SafeSpace Design System Tokens
 * Calm clinical + architectural decision-support workspace.
 * Light-first, high-legibility, WCAG AA compliant.
 */

export const tokens = {
  colors: {
    // Canvas & Surfaces
    canvas: "#f7f8f6",
    surface: "#ffffff",
    surfaceSubtle: "#f1f5f3",
    surfaceMuted: "#eaf0ed",
    surfaceHover: "#f8faf9",

    // Borders & Dividers
    border: "#e2e8e4",
    borderSubtle: "#eef2ef",
    borderStrong: "#cbd5e1",
    divider: "#e2e8e4",

    // Text & Foreground
    text: {
      primary: "#192329",
      secondary: "#475569",
      muted: "#64748b",
      subtle: "#94a3b8",
      inverse: "#ffffff",
    },

    // Brand & Primary Action (Single Controlled Teal)
    primary: {
      default: "#1e7168",
      hover: "#175b54",
      active: "#124741",
      surface: "#e8f3f1",
      surfaceHover: "#d9ece8",
      border: "#b8d9d4",
      contrast: "#ffffff",
    },

    // Semantic Status: Warning (Amber)
    warning: {
      default: "#d97706",
      hover: "#b45309",
      surface: "#fef3c7",
      border: "#fde68a",
      text: "#92400e",
    },

    // Semantic Status: Critical / Danger (Red)
    danger: {
      default: "#dc2626",
      hover: "#b91c1c",
      surface: "#fef2f2",
      border: "#fecaca",
      text: "#991b1b",
    },

    // Semantic Status: Verified / Pass (Emerald)
    success: {
      default: "#16a34a",
      hover: "#15803d",
      surface: "#ecfdf5",
      border: "#a7f3d0",
      text: "#065f46",
    },

    // Semantic Status: Informational (Slate/Neutral)
    info: {
      default: "#0284c7",
      surface: "#f0f9ff",
      border: "#bae6fd",
      text: "#075985",
    },
  },

  radii: {
    xs: "4px",
    sm: "6px",
    md: "8px",
    lg: "12px",
    full: "9999px",
  },

  typography: {
    fontSans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },

  shadows: {
    none: "none",
    subtle: "0 1px 2px 0 rgba(25, 35, 41, 0.05)",
    card: "0 1px 3px 0 rgba(25, 35, 41, 0.08), 0 1px 2px -1px rgba(25, 35, 41, 0.08)",
    popover: "0 4px 6px -1px rgba(25, 35, 41, 0.1), 0 2px 4px -2px rgba(25, 35, 41, 0.1)",
    modal: "0 10px 15px -3px rgba(25, 35, 41, 0.12), 0 4px 6px -4px rgba(25, 35, 41, 0.12)",
  },

  zIndex: {
    canvas: 0,
    overlay: 10,
    header: 20,
    dropdown: 30,
    modal: 40,
    toast: 50,
  },
} as const;

export type ThemeTokens = typeof tokens;
