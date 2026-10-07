import crypto from 'crypto';

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@expensemonitor.tech';
const OTP_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'default_secret'; // Use a consistent secret

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { phone, email } = req.body;
  if (!phone || !email) return res.status(400).json({ error: 'Phone and email required' });
  
  try {
    // 1. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 2. Hash the OTP with phone for stateless verification
    const hash = crypto.createHmac('sha256', OTP_SECRET)
                       .update(`${phone}:${otp}`)
                       .digest('hex');
                       
    // 3. Send Email via Resend
    if (!resendApiKey) {
      console.log(`[SIMULATED EMAIL] To: ${email}, Subject: Verify your phone number, OTP: ${otp}`);
      return res.status(200).json({ hash, simulated: true });
    }
    
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: email,
        subject: 'Verify your phone number for Expense Monitor',
        html: `
          <div style="font-family: sans-serif; max-w-md; margin: auto; padding: 20px; border-radius: 10px; background: #f8fafc;">
            <h2 style="color: #0f172a; margin-top: 0;">Verify your phone number</h2>
            <p style="color: #475569; font-size: 16px;">
              You requested to link the mobile number <strong>+91 ${phone}</strong> to your account.
            </p>
            <div style="margin: 30px 0; padding: 20px; background: white; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">Your Verification Code</p>
              <h1 style="color: #10b981; font-size: 42px; letter-spacing: 8px; margin: 0;">${otp}</h1>
            </div>
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">
              If you didn't request this, please ignore this email.
            </p>
          </div>
        `
      })
    });
    
    if (!resendRes.ok) {
      const errorData = await resendRes.json();
      throw new Error(errorData.message || 'Failed to send email via Resend');
    }
    
    return res.status(200).json({ hash });
    
  } catch (err) {
    console.error('Send OTP Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send OTP' });
  }
}
