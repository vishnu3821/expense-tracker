import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase } from './supabase';

const firebaseConfig = {
  apiKey: "AIzaSyDZGovWTi08w_xMk94Dnpvi07DUStynbPw",
  authDomain: "expense-tracker-cdf47.firebaseapp.com",
  projectId: "expense-tracker-cdf47",
  storageBucket: "expense-tracker-cdf47.firebasestorage.app",
  messagingSenderId: "406632111608",
  appId: "1:406632111608:web:398fdb11a47489fb33ca0d",
  measurementId: "G-C4JGKRYQ2D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

// Request permission and generate token
export const requestNotificationPermission = async (userId) => {
  try {
    console.log('[FCM] Requesting notification permission...');

    // Step 1: Check browser support
    if (!('Notification' in window)) {
      console.error('[FCM] This browser does not support notifications');
      return null;
    }
    if (!('serviceWorker' in navigator)) {
      console.error('[FCM] This browser does not support service workers');
      return null;
    }

    // Step 2: Request permission
    const permission = await Notification.requestPermission();
    console.log('[FCM] Permission result:', permission);

    if (permission !== 'granted') {
      console.warn('[FCM] Permission not granted:', permission);
      return null;
    }

    // Step 3: Register service worker explicitly
    let swRegistration;
    try {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      console.log('[FCM] Service worker registered:', swRegistration);
      // Wait for it to be ready
      await navigator.serviceWorker.ready;
    } catch (swErr) {
      console.error('[FCM] Service worker registration failed:', swErr);
      return null;
    }

    // Step 4: Get FCM token
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error('[FCM] VAPID key is missing from environment variables!');
      return null;
    }
    console.log('[FCM] Using VAPID key:', vapidKey.slice(0, 10) + '...');

    let token;
    try {
      token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: swRegistration,
      });
    } catch (tokenErr) {
      console.error('[FCM] getToken failed:', tokenErr);
      return null;
    }

    if (!token) {
      console.warn('[FCM] No token returned from getToken()');
      return null;
    }

    console.log('[FCM] Token obtained successfully:', token.slice(0, 20) + '...');

    // Step 5: Save token to Supabase
    const { error } = await supabase
      .from('user_fcm_tokens')
      .upsert({ user_id: userId, fcm_token: token }, { onConflict: 'user_id' });

    if (error) {
      console.error('[FCM] Error saving token to Supabase:', error);
      return null;
    }

    console.log('[FCM] Token saved to Supabase successfully');
    return token;

  } catch (err) {
    console.error('[FCM] Unexpected error:', err);
    return null;
  }
};

// Listener for foreground messages
export const onForegroundMessage = () => {
  return onMessage(messaging, (payload) => {
    console.log('[FCM] Message received in foreground:', payload);
  });
};
