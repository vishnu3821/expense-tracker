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

    // 🏆 Cleanest Template Logic (No nested backticks to avoid OXC parser issues)
    const getEmailHtml = (userEmail, customNote) => {
      const userName = userEmail.split('@')[0];
      const customNoteHtml = customNote 
        ? '<div style="background: #f0fdfa; border-left: 4px solid #0d9488; padding: 16px; margin-bottom: 24px; border-radius: 0 12px 12px 0; color: #0d9488; font-weight: 500;">' + customNote + '</div>'
        : '';
      
      return `
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
      <p>Hi ${userName},</p>
      ${customNoteHtml}
      <p>We've been working hard to make your financial journey smoother and more insightful. Here are the powerful new features waiting for you in the app:</p>
      <div class="feature-card">
        <div class="feature-title">💰 Your Savings Module <span class="badge">New</span></div>
        <div class="feature-desc">Track manual bank balances. See total wealth in one glance.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">💸 Auto-Balance Deduction <span class="badge">New</span></div>
        <div class="feature-desc">Auto-subtract amount from bank balance when logging expenses.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">🕵️ Privacy Mode <span class="badge">New</span></div>
        <div class="feature-desc">Hide sensitive balances with one tap.</div>
      </div>
      <div style="text-align: center;">
        <a href="https://expensemonitor.tech" class="btn">Explore New Features</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; 2026 Expense Tracker. All rights reserved.</p>
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
        subject: 'New Features: Savings & Privacy Mode are Here! 🚀',
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
