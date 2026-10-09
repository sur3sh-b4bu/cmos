const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
const port = 4000;

export const environment = {
  production: true,
  apiBaseUrl: `http://${host}:${port}/api`,
};
