import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  // GET all users (list)
  if (req.method === 'GET') {
    try {
      if (!supabaseUrl || !supabaseKey) {
        return res.status(200).json({ users: [], error: 'Configuration missing (URL/Key).' });
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Attempt 1: Auth Admin API (Best for emails)
      try {
        const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (!error && data?.users) {
          return res.status(200).json({ users: data.users });
        }
      } catch (e) {
        console.warn('Admin API failed, trying view...');
      }

      // Attempt 2: Profiles table (Standard for most Supabase apps)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name');
      
      if (!profileError && profileData?.length > 0) {
        return res.status(200).json({ users: profileData });
      }

      // Attempt 3: Database View (Legacy fallback)
      const { data: viewData, error: viewError } = await supabase
        .from('admin_user_emails')
        .select('*');
      
      if (viewError && !profileData) {
        throw new Error(`User retrieval failed: ${viewError.message}`);
      }
      
      return res.status(200).json({ users: viewData || [] });
    } catch (err) {
      console.error('GET announcement error:', err);
      return res.status(200).json({ users: [], error: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!resendApiKey) throw new Error('RESEND_API_KEY is not configured.');
    if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE configuration is incomplete.');

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { selectedUserIds, customMessage } = req.body;
    
    // Fetch users for matching (same robust logic)
    let allUsers = [];
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 }).catch(() => ({ data: null }));
    if (authData?.users) {
      allUsers = authData.users;
    } else {
      const { data: viewData } = await supabase.from('admin_user_emails').select('*');
      allUsers = viewData || [];
    }

    const targetUsers = selectedUserIds && selectedUserIds.length > 0
      ? allUsers.filter(u => selectedUserIds.includes(u.id))
      : allUsers;

    if (targetUsers.length === 0) {
      return res.status(200).json({ success: true, message: 'No target users matched.' });
    }

    // 🏆 Premium "Expense Monitor" Template
    const getEmailHtml = (userEmail, customNote) => {
      const userName = userEmail.split('@')[0];
      const customNoteHtml = customNote 
        ? '<div style="background: #f0fdfa; border-left: 4px solid #10b981; padding: 20px; margin-bottom: 24px; border-radius: 0 16px 16px 0; color: #047857; font-weight: 500; font-size: 15px;">' + customNote + '</div>'
        : '';
      
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 32px; }
    .logo { width: 120px; height: auto; margin-bottom: 16px; }
    .content { background: #ffffff; border-radius: 32px; padding: 48px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .hero-text { font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 12px; text-align: center; letter-spacing: -0.025em; }
    .sub-hero { font-size: 16px; color: #64748b; text-align: center; margin-bottom: 32px; }
    .feature-grid { display: grid; gap: 16px; margin: 32px 0; }
    .feature-card { background: #f1f5f9; border-radius: 20px; padding: 24px; border: 1px solid #f8fafc; }
    .feature-icon { font-size: 24px; margin-bottom: 12px; display: block; }
    .feature-title { font-weight: 700; color: #0f172a; font-size: 16px; margin-bottom: 4px; }
    .feature-desc { font-size: 14px; color: #475569; }
    .btn { display: block; background: #10b981; color: #ffffff !important; padding: 18px 32px; border-radius: 16px; text-decoration: none; font-weight: 700; text-align: center; margin-top: 32px; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.2); }
    .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #94a3b8; }
    .badge { background: #d1fae5; color: #065f46; font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 99px; text-transform: uppercase; margin-bottom: 8px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://expensemonitor.tech/logo.png" alt="Expense Monitor" class="logo">
      <div class="hero-text">The Evolution is Here.</div>
      <div class="sub-hero">Welcome to the all-new <b>Expense Monitor</b> experience.</div>
    </div>
    <div class="content">
      <p style="font-size: 16px;">Hello ${userName},</p>
      <p style="font-size: 16px;">We've completely transformed the way you track your finances. From a brand new identity to powerful modules, Expense Monitor is now faster, sleeker, and more capable than ever.</p>
      
      ${customNoteHtml}

      <div class="feature-card">
        <span class="badge">Rebranding</span>
        <div class="feature-title">✨ A New Identity</div>
        <div class="feature-desc">We've evolved from Expense Tracker to <b>Expense Monitor</b>, featuring a refined logo and a premium visual language.</div>
      </div>

      <div style="height: 16px;"></div>

      <div class="feature-card">
        <span class="badge">New Module</span>
        <div class="feature-title">🎓 Educational Fee Management</div>
        <div class="feature-desc">Dedicated section to track academic payments, store receipts, and manage your education-related expenses with ease.</div>
      </div>

      <div style="height: 16px;"></div>

      <div class="feature-card">
        <span class="badge">UI/UX</span>
        <div class="feature-title">💎 Premium Experience</div>
        <div class="feature-desc">Enjoy a state-of-the-art interface with glassmorphic elements, smooth animations, and a high-impact 1.5s startup sequence.</div>
      </div>

      <a href="https://expensemonitor.tech" class="btn">Experience Expense Monitor</a>
      
      <p style="text-align: center; font-size: 13px; color: #64748b; margin-top: 24px;">
        Log in now to see your upgraded dashboard.
      </p>
    </div>
    <div class="footer">
      <p>&copy; 2026 Expense Monitor. All rights reserved.</p>
      <p>Helping you master your finances, one transaction at a time.</p>
    </div>
  </div>
</body>
</html>`;
    };

    const batchData = targetUsers
      .filter(u => u.email)
      .slice(0, 100)
      .map(user => ({
        from: resendFromEmail,
        to: user.email,
        subject: '🚀 Introducing Expense Monitor: A New Financial Chapter',
        html: getEmailHtml(user.email, customMessage),
      }));

    if (batchData.length === 0) throw new Error('No valid user emails to send to.');

    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchData),
    });

    const resultData = await response.json();
    if (!response.ok) throw new Error(resultData.message || 'Batch send failed');

    return res.status(200).json({ 
      success: true, 
      message: `Announcement successfully queued for ${batchData.length} users.`,
      debug: { totalFound: targetUsers.length, batchSize: batchData.length }
    });

  } catch (err) {
    console.error('Broadcast Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
