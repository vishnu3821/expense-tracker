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
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT_KEY is not defined.");
    }
  } catch (error) {
    console.error("Firebase Admin Init Error:", error);
  }
}

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// We need the service role key to query all users securely, or anon key if RLS allows it (not recommended for raw crons).
// Since we only have anon key in .env right now, we will use it with the assumption that the `expenses` and `user_fcm_tokens`
// either have cron-based access or the user will provide a service role key.
// But wait, user_id is restricted by RLS for standard anon keys. 
// For this script, we'll request SUPABASE_SERVICE_ROLE_KEY to be set in Vercel.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Optional: Restrict to only POST or cron trigger auth.
  try {
    console.log("Running Daily Summary Push Notification Job...");

    // 1. Fetch all tokens
    const { data: tokensData, error: tokensError } = await supabase
      .from('user_fcm_tokens')
      .select('*');
      
    if (tokensError) throw tokensError;
    if (!tokensData || tokensData.length === 0) {
      return res.status(200).json({ message: "No registered tokens found." });
    }

    // 2. Determine "today" boundaries
    const now = new Date();
    // Setting to UTC for consistency, depending on the app's timezone requirements this might need tuning.
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    
    // 3. For each user, sum expenses
    const notificationsToSend = [];

    for (const record of tokensData) {
      const { user_id, fcm_token } = record;
      
      const { data: expenses, error: expError } = await supabase
        .from('expenses')
        .select('amount')
        .eq('user_id', user_id)
        .gte('date', todayStart);
        
      if (expError) {
        console.error(`Error fetching expenses for ${user_id}:`, expError);
        continue;
      }
      
      const todayTotal = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      
      if (todayTotal > 0) {
        // Construct message payload
        const payload = {
          notification: {
            title: "Daily Spending Summary 📊",
            body: `You recorded ₹${todayTotal.toFixed(2)} in total expenses today. Tap to review.`,
          },
          token: fcm_token
        };
        
        notificationsToSend.push(admin.messaging().send(payload));
      }
    }

    if (notificationsToSend.length > 0) {
      // 4. Dispatch batch
      const results = await Promise.allSettled(notificationsToSend);
      console.log("Firebase dispatch results:", results);
      return res.status(200).json({ success: true, dispatched: notificationsToSend.length, results });
    } else {
      return res.status(200).json({ success: true, message: "No expenses logged today. No notifications sent." });
    }
  } catch (error) {
    console.error("Cron Job Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
