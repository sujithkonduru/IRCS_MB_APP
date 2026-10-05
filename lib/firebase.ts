import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, off, query, orderByChild, limitToLast } from 'firebase/database';

// TODO: Replace with the real project credentials provided by Thoufiq / the backend team.
// The Employee App spec (Section 11) requires notifications to be delivered via
// Firebase Realtime Database, updating notification state in real time.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'REPLACE_ME',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'REPLACE_ME',
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || 'REPLACE_ME',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'REPLACE_ME',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'REPLACE_ME',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'REPLACE_ME',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'REPLACE_ME',
};

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'REQUEST_STATUS' | 'REQUEST_APPROVED' | 'REQUEST_REJECTED' | 'ATTENDANCE' | 'SYSTEM';
  read: boolean;
  createdAt: number;
}

/**
 * Subscribes to real-time notifications for a given employee at
 * `notifications/{userId}` and invokes `callback` whenever the list changes.
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void,
  onError?: (error: unknown) => void
) {
  try {
    const db = getDatabase(getFirebaseApp());
    const notifRef = query(ref(db, `notifications/${userId}`), orderByChild('createdAt'), limitToLast(100));

    const handler = (snapshot: any) => {
      const value = snapshot.val() || {};
      const list: AppNotification[] = Object.entries(value).map(([id, v]: [string, any]) => ({
        id,
        title: v.title || 'Notification',
        body: v.body || '',
        type: v.type || 'SYSTEM',
        read: !!v.read,
        createdAt: v.createdAt || Date.now(),
      }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    };

    onValue(notifRef, handler, (error) => onError?.(error));

    return () => off(notifRef, 'value', handler);
  } catch (error) {
    onError?.(error);
    return () => {};
  }
}
