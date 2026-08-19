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
    const { selectedUserIds, customMessage, subject } = req.body;
    
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

    // 🏆 Clean Custom Message Template with Features
    const getEmailHtml = (userEmail, messageText) => {
      const userName = userEmail.split('@')[0];
      const customNoteHtml = messageText 
        ? '<div style="background: #f0fdfa; border-left: 4px solid #10b981; padding: 20px; margin-bottom: 32px; border-radius: 0 16px 16px 0; color: #047857; font-weight: 500; font-size: 15px; white-space: pre-wrap;">' + messageText + '</div>'
        : '';
      
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f1f5f9; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 32px; }
    .logo-text { font-size: 24px; font-weight: 900; color: #0f172a; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 24px; letter-spacing: -0.5px; }
    .content { background: #ffffff; border-radius: 24px; padding: 40px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
    .hero-text { font-size: 26px; font-weight: 800; color: #0f172a; margin-bottom: 12px; text-align: center; letter-spacing: -0.025em; }
    .sub-hero { font-size: 16px; color: #64748b; text-align: center; margin-bottom: 32px; }
    .feature-card { background: #f8fafc; border-radius: 16px; padding: 20px; margin-bottom: 16px; border: 1px solid #f1f5f9; border-left: 4px solid #0ea5e9; }
    .feature-card.old { border-left: 4px solid #94a3b8; opacity: 0.9; }
    .feature-title { font-weight: 700; color: #0f172a; font-size: 16px; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
    .feature-desc { font-size: 14px; color: #475569; }
    .badge { background: #d1fae5; color: #065f46; font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 99px; text-transform: uppercase; margin-bottom: 8px; display: inline-block; }
    .badge.old { background: #f1f5f9; color: #64748b; }
    .message-body { font-size: 16px; color: #334155; line-height: 1.8; margin-bottom: 32px; }
    .btn { display: block; background: #0f172a; color: #ffffff !important; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; text-align: center; margin-top: 32px; font-size: 16px; transition: all 0.2s; }
    .footer { text-align: center; margin-top: 32px; font-size: 13px; color: #94a3b8; }
    .highlight { color: #0ea5e9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-text">💸 Expense Monitor</div>
    </div>
    <div class="content">
      <div class="hero-text">Exciting New Updates 🎉</div>
      <div class="sub-hero">See what's new in your financial dashboard.</div>
      
      <p style="font-size: 16px; margin-bottom: 24px;">Hello <strong class="highlight">${userName}</strong>,</p>
      
      ${customNoteHtml}

      <div class="feature-card">
        <span class="badge">New Feature</span>
        <div class="feature-title">💬 In-App Direct Feedback</div>
        <div class="feature-desc">You can now report bugs, suggest features, or reach out to the admin directly from the top navigation bar!</div>
      </div>

      <div class="feature-card">
        <span class="badge">New Feature</span>
        <div class="feature-title">⚡ Performance Upgrades</div>
        <div class="feature-desc">Your dashboard now loads faster than ever. We've optimized the financial intelligence engine so your metrics appear instantly.</div>
      </div>

      <div class="feature-card">
        <span class="badge">New Feature</span>
        <div class="feature-title">🎨 Beautiful New UI</div>
        <div class="feature-desc">Enjoy a more polished, modern, and seamless user interface with micro-animations and a stunning dark mode.</div>
      </div>

      <!-- Previously added features -->
      <div class="feature-card old">
        <span class="badge old">Enhancement</span>
        <div class="feature-title">🏦 Universal Bank Statement Upload</div>
        <div class="feature-desc">Upload your bank statement directly (PDF, Excel, or CSV) from ANY major bank (SBI, HDFC, ICICI, etc.). The AI automatically skips the junk, parses your debits, decrypts password-protected PDFs, and bulk imports your expenses instantly!</div>
      </div>

      <div class="feature-card old">
        <span class="badge old">Enhancement</span>
        <div class="feature-title">📸 AI Receipt Scanner</div>
        <div class="feature-desc">Scan a photo of your UPI payment receipt. Our built-in AI vision engine will instantly extract the Transaction ID for your records!</div>
      </div>

      <div class="feature-card old">
        <span class="badge old">Enhancement</span>
        <div class="feature-title">👯‍♂️ Split with Friends</div>
        <div class="feature-desc">Easily split bills with friends. Log your share, track who has to pay you, and settle debts with one click!</div>
      </div>

      <div class="feature-card old">
        <span class="badge old">Enhancement</span>
        <div class="feature-title">🧩 Drag & Drop Dashboard</div>
        <div class="feature-desc">Your Dashboard, your rules. Rearrange the layout exactly how you want it with intuitive drag-and-drop customization.</div>
      </div>

      <div class="feature-card old">
        <span class="badge old">Enhancement</span>
        <div class="feature-title">🧠 AI Smart Categorization</div>
        <div class="feature-desc">The app now learns your spending habits! We automatically select the right category and payment mode based on your past history.</div>
      </div>

      <a href="https://expensemonitor.tech" class="btn">Open Your Dashboard</a>
    </div>
    <div class="footer">
      <p>&copy; 2026 Expense Monitor. All rights reserved.</p>
      <p>Helping you master your finances, one transaction at a time.</p>
      <p style="margin-top: 16px; font-size: 11px; font-style: italic; color: #cbd5e1;">This is a system-generated email. Please do not reply to this message.</p>
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
        subject: subject || 'Important Update from Expense Monitor',
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
