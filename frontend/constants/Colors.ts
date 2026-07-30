const tintColorLight = '#2f95dc';
const tintColorDark = '#fff';

export const COLORS = {
  // ---- Figma palette (BiteWise design file) ----
  // Canvas notes in the file call out: #2E4053, #F3DD39, #F1F6FD, #B49221.
  // Background pushed one step bluer than the mock on request.
  darkNavy: '#2E4053',        // primary — headers, buttons, text
  yellowAccent: '#F3DD39',    // the design's bright brand yellow
  goldYellow: '#F3DD39',      // aligned to the Figma yellow (was #FCD451)
  darkGold: '#B49221',        // deep gold from the design notes (was #D4AC0D)
  lightYellow: '#FCF7D9',     // pale yellow card tint to pair with F3DD39

  // ---- Blues ----
  background: '#EDF4FE',      // app background — Figma's F1F6FD, +1 blue
  lightBlueBg: '#E2EDFC',     // section tint / diagonal header wash
  blueSoft: '#D6E5F8',        // pressed states, subtle fills

  // ---- Neutrals, cooled toward blue ----
  white: '#FFFFFF',
  cardWhite: '#FFFFFF',
  textDark: '#1C2A3A',        // near-navy instead of near-black
  textMuted: '#5B6C80',       // blue-gray (was warm gray #6B7280)
  borderLight: '#D9E4F1',     // bluish borders (was gray #E5E7EB)
  inactiveGray: '#8298AE',    // blue-gray inactive (was #85929E)

  redAccent: '#E74C3C',
};

export default {
  light: {
    text: '#000',
    background: '#fff',
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
  },
};