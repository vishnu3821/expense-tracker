import crypto from 'crypto';

const OTP_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'default_secret'; // Must match send API

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { phone, otp, hash } = req.body;
  if (!phone || !otp || !hash) return res.status(400).json({ error: 'Phone, OTP, and hash required' });
  
  try {
    const computedHash = crypto.createHmac('sha256', OTP_SECRET)
                               .update(`${phone}:${otp}`)
                               .digest('hex');
                               
    if (computedHash === hash) {
      return res.status(200).json({ verified: true });
    } else {
      return res.status(400).json({ verified: false, error: 'Invalid or expired OTP' });
    }
  } catch (err) {
    console.error('Verify OTP Error:', err);
    return res.status(500).json({ error: 'Internal server error during verification' });
  }
}
