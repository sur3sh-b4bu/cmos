// The dev API listens on port 4000 of whatever machine is serving the app.
// Hardcoding `localhost` breaks the moment the page is opened from another
// device -- which is exactly what happens when someone scans the QR code on a
// receipt with their phone: `localhost` would resolve to the *phone*, not the
// office machine. Derive the host from the page's own URL instead.
const apiHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

export const environment = {
  production: false,
  apiBaseUrl: `http://${apiHost}:4000/api`,
};
