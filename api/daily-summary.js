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

    console.log('Running Daily Summary Push Notification Job...');

    const { data: tokensData, error: tokensError } = await supabase
      .from('user_fcm_tokens')
      .select('*');

    if (tokensError) throw tokensError;
    if (!tokensData || tokensData.length === 0) {
      return res.status(200).json({ message: 'No registered tokens found.' });
    }

    // Today's date boundaries (UTC)
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

    const results = [];
    for (const record of tokensData) {
      const { user_id, fcm_token } = record;

      const { data: expenses, error: expError } = await supabase
        .from('expenses')
        .select('amount')
        .eq('user_id', user_id)
        .gte('date', todayStart);

      if (expError) {
        results.push({ user_id, error: expError.message });
        continue;
      }

      const todayTotal = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

      if (todayTotal > 0) {
        try {
          await sendFCMNotification(
            fcm_token,
            'Daily Spending Summary 📊',
            `You recorded ₹${todayTotal.toFixed(2)} in total expenses today. Tap to review.`,
            serviceAccount
          );
          results.push({ user_id, sent: true, total: todayTotal });
        } catch (fcmErr) {
          results.push({ user_id, sent: false, error: fcmErr.message });
        }
      } else {
        results.push({ user_id, sent: false, reason: 'No expenses today' });
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (error) {
    console.error('Daily Summary Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
