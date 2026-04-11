import { createClient } from '@supabase/supabase-js';
import { sendFCMNotification } from './_fcm.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  try {
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountRaw) {
      return res.status(500).json({ error: 'FIREBASE_SERVICE_ACCOUNT_KEY is not set.' });
    }
    const serviceAccount = JSON.parse(serviceAccountRaw);

    const now = new Date();
    console.log(`Running Daily Summary Push Notification Job at ${now.toISOString()}...`);

    // Fetch all users with FCM tokens
    const { data: tokensData, error: tokensError } = await supabase
      .from('user_fcm_tokens')
      .select('user_id, fcm_token, email');

    if (tokensError) throw tokensError;
    if (!tokensData || tokensData.length === 0) {
      return res.status(200).json({ message: 'No active FCM tokens found.' });
    }

    // Calculate today's start in IST (UTC+5:30)
    // 9 PM IST matches 15:30 UTC. We want expenses from 12 AM IST today.
    // 12 AM IST today is 6:30 PM UTC (18:30) of the previous calendar day.
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const istStartOfDay = new Date(Date.UTC(
      istNow.getUTCFullYear(),
      istNow.getUTCMonth(),
      istNow.getUTCDate()
    ));
    const todayStart = new Date(istStartOfDay.getTime() - istOffset).toISOString();
    
    console.log(`Querying expenses since (IST 12 AM): ${todayStart}`);

    const results = [];
    for (const record of tokensData) {
      const { user_id, fcm_token, email } = record;

      const { data: expenses, error: expError } = await supabase
        .from('expenses')
        .select('amount, category')
        .eq('user_id', user_id)
        .gte('date', todayStart)
        .neq('category', 'Transfer'); // 🔥 Exclude internal transfers

      if (expError) {
        console.error(`Error fetching expenses for user ${user_id}:`, expError);
        results.push({ user_id, error: expError.message });
        continue;
      }

      const todayTotal = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      const formattedTotal = todayTotal.toLocaleString('en-IN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
      });

      try {
        const body = todayTotal > 0 
          ? `You recorded ₹${formattedTotal} in total expenses today. Tap to review.`
          : "You stayed on budget and recorded ₹0 in expenses today! 🌟";

        await sendFCMNotification(
          fcm_token,
          'Daily Spending Summary 📊',
          body,
          serviceAccount
        );
        console.log(`Successfully sent daily summary to user ${user_id} (${email || 'unknown'}). Total: ${todayTotal}`);
        results.push({ user_id, sent: true, total: todayTotal });
      } catch (fcmErr) {
        console.error(`FCM Error for user ${user_id}:`, fcmErr);
        results.push({ user_id, sent: false, error: fcmErr.message });
      }
    }

    return res.status(200).json({ 
      success: true, 
      count: tokensData.length,
      timestamp: now.toISOString(),
      results 
    });
  } catch (error) {
    console.error('Daily Summary Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
