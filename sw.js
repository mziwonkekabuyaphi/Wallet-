// Rands Wallet Service Worker for GitHub Pages
// Repository: https://github.com/mziwonkekabuyaphi/Wallet-
// Live URL: https://mziwonkekabuyaphi.github.io/Wallet-/

const CACHE_NAME = 'rands-wallet-v1.0.0';
const REPO_PATH = '/Wallet-';
const OFFLINE_URL = REPO_PATH + '/offline.html';

// Assets to cache immediately on install
const PRECACHE_URLS = [
  REPO_PATH + '/',
  REPO_PATH + '/index.html',
  REPO_PATH + '/wallet.html',        // Changed from dashboard.html
  REPO_PATH + '/offline.html',
  REPO_PATH + '/manifest.json',
  REPO_PATH + '/icons/icon-192x192.png',
  REPO_PATH + '/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install event - cache core assets
self.addEventListener('install', event => {
  console.log('[SW] Installing Rands Wallet...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precaching assets');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Return cached version and update in background
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, networkResponse);
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(error => {
            console.error('[SW] Fetch failed:', error);
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            return new Response('Offline - Content unavailable', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Background sync for pending transactions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

async function syncPendingTransactions() {
  console.log('[SW] Syncing pending transactions...');
  const pending = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
  
  if (pending.length === 0) return;
  
  for (const transaction of pending) {
    try {
      const response = await fetch(REPO_PATH + '/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction)
      });
      
      if (response.ok) {
        const updated = pending.filter(t => t.id !== transaction.id);
        localStorage.setItem('pendingTransactions', JSON.stringify(updated));
        
        self.registration.showNotification('Transaction Synced', {
          body: `✓ ${transaction.amount} sent successfully`,
          icon: REPO_PATH + '/icons/icon-192x192.png',
          vibrate: [200, 100, 200]
        });
      }
    } catch (error) {
      console.error('[SW] Sync failed:', error);
    }
  }
}

// Push notification handler
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'You have a new notification',
    icon: REPO_PATH + '/icons/icon-192x192.png',
    badge: REPO_PATH + '/icons/icon-192x192.png',  // Changed from badge-icon.png
    vibrate: [200, 100, 200],
    data: {
      url: data.url || REPO_PATH + '/wallet.html'  // Changed from dashboard.html
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Rands Wallet', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    const urlToOpen = event.notification.data?.url || REPO_PATH + '/wallet.html';  // Changed from dashboard.html
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(windowClients => {
          for (let client of windowClients) {
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

// Message handling for skipWaiting
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});