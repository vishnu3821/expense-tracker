import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // GET all users (list)
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) throw error;
      return res.status(200).json({ users: data.users || [] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Add a secret key check here if you want to prevent unauthorized broadcasts
  // const { secret } = req.body;
  // if (secret !== process.env.BROADCAST_SECRET) return res.status(401).end();

  try {
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured.');
    }

    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured in Vercel environment.');
    }

    const { selectedUserIds, customMessage } = req.body;

    console.log('Fetching users for broadcast...');
    console.log('Supabase URL:', supabaseUrl ? 'Configured' : 'Missing');
    
    // Fetch all users from Auth (requires Service Role Key)
    const { data, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error('Supabase Auth Admin Error:', userError);
      throw userError;
    }

    const allUsers = data?.users || [];
    
    // Filter users if list provided
    const targetUsers = selectedUserIds && selectedUserIds.length > 0
      ? allUsers.filter(u => selectedUserIds.includes(u.id))
      : allUsers;

    if (targetUsers.length === 0) {
      return res.status(200).json({ success: true, message: 'No target users found.', debug: { url: !!supabaseUrl, key: !!supabaseKey } });
    }

    console.log(`Sending announcement to ${targetUsers.length} users...`);

    const emailTemplate = (userName, customNote) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; }
    .logo { width: 80px; height: 80px; margin-bottom: 20px; }
    .content { background: #ffffff; border-radius: 24px; padding: 40px; border: 1px solid #e2e8f0; }
    .hero-text { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 16px; text-align: center; }
    .feature-card { background: #f8fafc; border-radius: 16px; padding: 24px; margin-bottom: 20px; border: 1px solid #f1f5f9; }
    .feature-title { font-weight: 700; color: #0d9488; font-size: 18px; margin-bottom: 8px; display: flex; align-items: center; }
    .feature-desc { font-size: 14px; color: #64748b; }
    .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #94a3b8; }
    .btn { display: inline-block; background: #0d9488; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 24px; }
    .badge { background: #ccfbf1; color: #0f766e; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 99px; text-transform: uppercase; margin-left: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://expensemonitor.tech/logo.png" alt="Expense Tracker" class="logo">
      <div class="hero-text">Big Updates are Here! 🚀</div>
      <p>Master your finances with the all-new Expense Tracker.</p>
    </div>
    
    <div class="content">
      <p>Hi ${userName || 'there'},</p>
      ${customNote ? `<div style="background: #f0fdfa; border-left: 4px solid #0d9488; padding: 16px; margin-bottom: 24px; border-radius: 0 12px 12px 0; color: #0d9488; font-weight: 500;">${customNote}</div>` : ''}
      <p>We've been working hard to make your financial journey smoother and more insightful. Here are the powerful new features waiting for you in the app:</p>
      
      <div class="feature-card">
        <div class="feature-title">💰 Your Savings Module <span class="badge">New</span></div>
        <div class="feature-desc">Track your manual bank balances across all your accounts. See your total wealth in one glance, no real-time linking required.</div>
      </div>
      
      <div class="feature-card">
        <div class="feature-title">💸 Auto-Balance Deduction <span class="badge">New</span></div>
        <div class="feature-desc">When you log an expense, simply select which bank account you paid from. The app will automatically subtract the amount from your balance!</div>
      </div>
      
      <div class="feature-card">
        <div class="feature-title">🕵️ Privacy Mode <span class="badge">New</span></div>
        <div class="feature-desc">Using the app in a public place? One tap on the "Eye" icon in Savings hides all your sensitive balances instantly.</div>
      </div>

      <div class="feature-card">
        <div class="feature-title">📊 Automated PDF Reports</div>
        <div class="feature-desc">Get professional monthly summaries sent straight to your email on the 1st of every month automatically.</div>
      </div>
      
      <div style="text-align: center;">
        <a href="https://expensemonitor.tech" class="btn">Explore New Features</a>
      </div>
    </div>
    
    <div class="footer">
      <p>&copy; 2026 Expense Tracker. All rights reserved.</p>
      <p>You received this email because you registered for Expense Tracker.</p>
    </div>
  </div>
</body>
</html>
    `;

    const broadcastResults = [];

    // Process in small batches or one by one for reliability
    for (const user of targetUsers) {
      if (!user.email) continue;

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: resendFromEmail,
            to: user.email,
            subject: 'New Features: Your Savings & Privacy Mode are Here! 🚀',
            html: emailTemplate(user.email.split('@')[0], customMessage),
          }),
        });

        const data = await response.json();
        broadcastResults.push({ email: user.email, status: response.ok ? 'success' : 'failed', data });
      } catch (err) {
        broadcastResults.push({ email: user.email, status: 'error', reason: err.message });
      }
    }

    const successCount = broadcastResults.filter(r => r.status === 'success').length;
    const failureSample = broadcastResults.find(r => r.status !== 'success')?.data?.message || broadcastResults.find(r => r.status !== 'success')?.reason || 'None';

    return res.status(200).json({ 
      success: true, 
      message: successCount > 0 
        ? `Announcement sent to ${successCount} users.` 
        : `Sent to 0 users. Main Error: ${failureSample}`,
      details: broadcastResults 
    });

  } catch (err) {
    console.error('Broadcast Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
