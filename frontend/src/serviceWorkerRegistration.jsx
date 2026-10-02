const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/)
);

const getPublicUrl = () => {
  // Vite uses import.meta.env.BASE_URL instead of process.env.PUBLIC_URL
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.BASE_URL || '';
  }
  return '';
};

export function register(config) {
  if ('serviceWorker' in navigator) {
    const publicUrl = getPublicUrl();
    window.addEventListener('load', () => {
      const swUrl = `${publicUrl}/service-worker.js`;
      if (isLocalhost) {
        checkValidServiceWorker(swUrl, config);
      } else {
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker.register(swUrl).then((registration) => {
    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;
      installingWorker.onstatechange = () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            console.log('[SW] Nouvelle version disponible — rechargez la page.');
            if (config && config.onUpdate) config.onUpdate(registration);
          } else {
            console.log('[SW] Application disponible hors-ligne.');
            if (config && config.onSuccess) config.onSuccess(registration);
          }
        }
      };
    };
  }).catch((error) => console.error('[SW] Erreur d\'enregistrement:', error));
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (response.status === 404 || (contentType != null && !contentType.includes('javascript'))) {
        navigator.serviceWorker.ready.then((r) => r.unregister()).then(() => window.location.reload());
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => console.log('[SW] Pas de connexion — mode hors-ligne.'));
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((r) => r.unregister()).catch(console.error);
  }
}