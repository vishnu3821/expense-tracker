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

    console.log('Running 6-hour Reminder Push Notification Job...');

    const { data: tokensData, error: tokensError } = await supabase
      .from('user_fcm_tokens')
      .select('*');

    if (tokensError) throw tokensError;
    if (!tokensData || tokensData.length === 0) {
      return res.status(200).json({ message: 'No tokens found.' });
    }

    const results = [];
    for (const record of tokensData) {
      try {
        await sendFCMNotification(
          record.fcm_token,
          'Quick Reminder ⏰',
          "Don't forget to log your recent expenses to keep your budget on track!",
          serviceAccount
        );
        results.push({ user_id: record.user_id, sent: true });
      } catch (fcmErr) {
        results.push({ user_id: record.user_id, sent: false, error: fcmErr.message });
      }
    }

    return res.status(200).json({ success: true, dispatched: results.length, results });
  } catch (error) {
    console.error('Reminder Cron Job Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
