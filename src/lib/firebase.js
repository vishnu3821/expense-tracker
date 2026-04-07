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
    console.log('Requesting notification permission...');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');

      // You need to configure a VAPID key in Firebase Console (Project Settings -> Cloud Messaging -> Web configuration)
      // but if not provided, getToken uses the default. It's recommended to generate a Key Pair in the Cloud Messaging tab.
      // For now we attempt getToken without a explicit vapidKey if not available.
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
      });
      
      if (token) {
        // Save logic to Supabase
        const { error } = await supabase
          .from('user_fcm_tokens')
          .upsert({ user_id: userId, fcm_token: token }, { onConflict: 'user_id' });
          
        if (error) {
          console.error("Error saving token to Supabase:", error);
          return null;
        }
        
        return token;
      } else {
        console.log('No registration token available. Request permission to generate one.');
        return null;
      }
    } else {
      console.log('Notification permission denied.');
      return null;
    }
  } catch (err) {
    console.error("Error during permission request:", err);
    return null;
  }
};

// Listener for foreground messages
export const onForegroundMessage = () => {
    return onMessage(messaging, (payload) => {
        console.log('Message received in foreground: ', payload);
        // Note: in your React component you can show a toast here.
    });
};
