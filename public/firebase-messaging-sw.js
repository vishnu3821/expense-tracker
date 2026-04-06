// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
const firebaseConfig = {
  apiKey: "AIzaSyDZGovWTi08w_xMk94Dnpvi07DUStynbPw",
  authDomain: "expense-tracker-cdf47.firebaseapp.com",
  projectId: "expense-tracker-cdf47",
  storageBucket: "expense-tracker-cdf47.firebasestorage.app",
  messagingSenderId: "406632111608",
  appId: "1:406632111608:web:398fdb11a47489fb33ca0d"
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  
  // Customize notification here
  const notificationTitle = payload.notification?.title || 'Expense Summary';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new update.',
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
