import * as Sentry from '@sentry/react';

// ── Sentry — observabilité frontend (prod uniquement si DSN configuré) ───────
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,          // 10% des transactions — économie bande passante
    replaysOnErrorSampleRate: 1.0,  // 100% replay sur erreurs
    replaysSessionSampleRate: 0.0,  // pas de replay session en continu
    sendDefaultPii: false,          // RGPD — pas de données personnelles
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: false }),
    ],
    beforeSend(event) {
      // Ne pas envoyer les erreurs réseau bénignes (connexions africaines instables)
      if (event.exception?.values?.[0]?.type === 'AxiosError') {
        const status = event.exception.values[0]?.value;
        if (status?.includes('Network Error') || status?.includes('timeout')) return null;
      }
      return event;
    },
  });
}

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { register } from './serviceWorkerRegistration';

// Register the service worker for offline support and faster load times
register();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);