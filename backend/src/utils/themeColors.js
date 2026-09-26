/**
 * Server-side mirror of the frontend's per-church brand palette
 * (frontend/src/styles/_tokens.scss's [data-brand-theme] blocks) -- printed
 * PDFs (receipts, daily register, collections breakdown) use the same
 * "primary" hue as the on-screen sidebar/header for the church that owns
 * them, instead of a hardcoded navy. Gold stays constant across every theme;
 * only this primary hex changes. Keep these values in sync with
 * _tokens.scss's --coms-color-primary overrides by hand -- there's no
 * shared source between the two build systems.
 */
const PRIMARY_BY_THEME = {
  blue: '#072a63',
  green: '#0b4d2c',
  red: '#7a1620',
  violet: '#3a2472',
  orange: '#8a3d12',
  purple: '#5c1a6b',
  pink: '#7a1450',
  teal: '#0c504b',
  maroon: '#5c0d1e',
  slate: '#24303f',
  amber: '#784c08',
  cyan: '#0b4f6c',
  olive: '#334d1b',
  bronze: '#4d2e14',
  plum: '#48164b',
};

const GOLD = '#B08D2B';

function getThemePrimaryColor(themeColor) {
  return PRIMARY_BY_THEME[themeColor] || PRIMARY_BY_THEME.blue;
}

module.exports = { getThemePrimaryColor, GOLD };
