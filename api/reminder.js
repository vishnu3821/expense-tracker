import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount))
      });
    }
  } catch (error) {
    console.error("Firebase Admin Init Error:", error);
  }
}

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  try {
    console.log("Running 6-hour Reminder Push Notification Job...");

    const { data: tokensData, error: tokensError } = await supabase
      .from('user_fcm_tokens')
      .select('*');
      
    if (tokensError) throw tokensError;
    if (!tokensData || tokensData.length === 0) {
      return res.status(200).json({ message: "No tokens found." });
    }

    const notificationsToSend = tokensData.map(record => {
      const payload = {
        notification: {
          title: "Quick Reminder ⏰",
          body: "Don't forget to log your recent expenses to keep your budget on track!",
        },
        token: record.fcm_token
      };
      return admin.messaging().send(payload);
    });

    if (notificationsToSend.length > 0) {
      const results = await Promise.allSettled(notificationsToSend);
      console.log("Firebase dispatch results:", results);
      return res.status(200).json({ success: true, dispatched: notificationsToSend.length });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Reminder Cron Job Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
