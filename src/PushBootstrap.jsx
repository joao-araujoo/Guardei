import { useEffect, useRef } from 'react';
import { createRepository } from './lib/storage.js';

const repository = createRepository();
const LAST_TEST_ENDPOINT_KEY = 'guardei.push.tested-endpoint.v1';

export default function PushBootstrap() {
  const syncingRef = useRef(false);

  useEffect(() => {
    let disposed = false;

    const sync = async () => {
      if (disposed || syncingRef.current) return;
      syncingRef.current = true;
      try {
        const settings = await repository.getSettings?.();
        if (!settings) return;

        if (settings.smartNotificationsEnabled && Notification.permission === 'granted') {
          await ensurePushSubscription();
        } else if (!settings.smartNotificationsEnabled) {
          await removePushSubscription();
        }
      } catch (error) {
        if (error?.status !== 401) console.warn('Web Push sync:', error);
      } finally {
        syncingRef.current = false;
      }
    };

    const timer = window.setInterval(sync, 12_000);
    const onFocus = () => sync();
    const onMessage = event => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_REFRESH') sync();
    };

    window.addEventListener('focus', onFocus);
    navigator.serviceWorker?.addEventListener?.('message', onMessage);
    window.setTimeout(sync, 1200);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      navigator.serviceWorker?.removeEventListener?.('message', onMessage);
    };
  }, []);

  return null;
}

async function ensurePushSubscription() {
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return null;

  const config = await apiRequest('/api/push/public-key');
  if (!config?.enabled || !config.publicKey) return null;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  const expectedKey = urlBase64ToUint8Array(config.publicKey);

  if (subscription && !sameApplicationServerKey(subscription.options?.applicationServerKey, expectedKey)) {
    await unregisterSubscription(subscription);
    await subscription.unsubscribe().catch(() => {});
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: expectedKey,
    });
  }

  await apiRequest('/api/push/subscribe', {
    method: 'POST',
    body: {
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent,
    },
  });

  const endpoint = subscription.endpoint;
  if (localStorage.getItem(LAST_TEST_ENDPOINT_KEY) !== endpoint) {
    const test = await apiRequest('/api/push/test', { method: 'POST', optional: true });
    if (test?.ok) localStorage.setItem(LAST_TEST_ENDPOINT_KEY, endpoint);
  }

  return subscription;
}

async function removePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  const subscription = await registration?.pushManager?.getSubscription?.();
  if (!subscription) return;

  await unregisterSubscription(subscription);
  await subscription.unsubscribe().catch(() => {});
  if (localStorage.getItem(LAST_TEST_ENDPOINT_KEY) === subscription.endpoint) {
    localStorage.removeItem(LAST_TEST_ENDPOINT_KEY);
  }
}

async function unregisterSubscription(subscription) {
  await apiRequest('/api/push/subscribe', {
    method: 'DELETE',
    body: { endpoint: subscription.endpoint },
    optional: true,
  });
}

async function apiRequest(path, { method = 'GET', body, optional = false } = {}) {
  const base = String(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_VAULT_API_URL || window.VAULT_API_URL || '').replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    if (optional) return null;
    const error = new Error(`Push API ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.status === 204 ? null : response.json();
}

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

function sameApplicationServerKey(current, expected) {
  if (!current) return false;
  const left = new Uint8Array(current);
  if (left.length !== expected.length) return false;
  return left.every((byte, index) => byte === expected[index]);
}
