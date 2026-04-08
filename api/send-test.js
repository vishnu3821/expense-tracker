import { createClient } from '@supabase/supabase-js';
import { sendFCMNotification } from './_fcm.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  const isServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountRaw) {
      return res.status(500).json({ 
        error: 'FIREBASE_SERVICE_ACCOUNT_KEY is not set in Vercel. Please add it to your environment variables and redeploy.' 
      });
    }
    const serviceAccount = JSON.parse(serviceAccountRaw);

    // 1. Fetch token from Supabase
    const { data: record, error: tokenError } = await supabase
      .from('user_fcm_tokens')
      .select('fcm_token')
      .eq('user_id', user_id)
      .maybeSingle();

    if (tokenError) throw tokenError;
    
    if (!record) {
      if (!isServiceKey) {
        return res.status(500).json({ 
          error: 'No notification token found. CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in Vercel. The backend is using the Anon Key, which is blocked by RLS policies. Please add the Service Role Key to your environment variables.' 
        });
      }
      return res.status(404).json({ error: `No notification token found for user ID: ${user_id}. Please try toggling notifications OFF and then ON again in the app to refresh the token.` });
    }

    // 2. Send test notification
    try {
      await sendFCMNotification(
        record.fcm_token,
        'Diagnostic Test 🛠️',
        'Testing 1, 2, 3! If you see this, your notification pipeline is working perfectly.',
        serviceAccount
      );
      
      return res.status(200).json({ 
        success: true, 
        message: 'Notification sent successfully! Check your phone.' 
      });
    } catch (fcmErr) {
      console.error('FCM Error:', fcmErr);
      return res.status(500).json({ 
        error: `Firebase FCM Error: ${fcmErr.message}. This usually means your server-side keys are invalid or expired.` 
      });
    }
  } catch (err) {
    console.error('Diagnostic API Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
