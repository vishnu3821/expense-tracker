import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { splitId, friendEmail, friendName, amount, expenseName, ownerName } = req.body;

  if (!splitId || !friendEmail || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Update the split with friend email + notified timestamp
    const { error: updateError } = await supabase
      .from('splits')
      .update({ 
        friend_email: friendEmail, 
        notified_at: new Date().toISOString() 
      })
      .eq('id', splitId)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    // 2. Check if friend is an app user (look for their user by email)
    const { data: allUsers } = await supabase.auth.admin.listUsers();
    const friendUser = allUsers?.users?.find(u => u.email === friendEmail);

    // 3. If they're an app user, create an in-app notification
    if (friendUser) {
      await supabase
        .from('split_notifications')
        .insert({
          recipient_user_id: friendUser.id,
          split_id: splitId,
          sender_name: ownerName || user.email,
          sender_email: user.email,
          friend_name: friendName,
          amount: Number(amount),
          expense_name: expenseName,
          status: 'unread'
        });
    }

    // 4. Send the notification email via Resend
    if (RESEND_API_KEY) {
      const appUrl = process.env.VITE_APP_URL || 'https://expense-monitor.vercel.app';
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="margin:0;padding:0;background:#0a0f1e;font-family:'Inter',sans-serif;">
          <div style="max-width:500px;margin:0 auto;padding:40px 24px;">
            
            <!-- Header -->
            <div style="text-align:center;margin-bottom:32px;">
              <div style="display:inline-block;background:linear-gradient(135deg,#34ffb4,#00d4aa);border-radius:16px;padding:12px 20px;">
                <span style="color:#060a12;font-weight:900;font-size:18px;letter-spacing:0.05em;">Expense Monitor</span>
              </div>
            </div>

            <!-- Main Card -->
            <div style="background:#111827;border-radius:24px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
              
              <!-- Icon -->
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;background:rgba(251,146,60,0.15);border-radius:50%;border:1px solid rgba(251,146,60,0.3);">
                  <span style="font-size:32px;">🤝</span>
                </div>
              </div>

              <!-- Title -->
              <h1 style="color:#ffffff;font-size:22px;font-weight:800;text-align:center;margin:0 0 8px;">
                You owe someone money!
              </h1>
              <p style="color:#6b7280;text-align:center;font-size:14px;margin:0 0 32px;">
                ${ownerName || user.email} split an expense with you
              </p>

              <!-- Amount Box -->
              <div style="background:rgba(251,146,60,0.1);border:1px solid rgba(251,146,60,0.3);border-radius:16px;padding:20px;text-align:center;margin-bottom:24px;">
                <p style="color:#fb923c;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">You owe</p>
                <p style="color:#ffffff;font-size:40px;font-weight:900;margin:0;">₹${Number(amount).toLocaleString('en-IN')}</p>
                <p style="color:#6b7280;font-size:13px;margin:8px 0 0;">For: <strong style="color:#d1d5db;">${expenseName || 'a shared expense'}</strong></p>
              </div>

              <!-- Split Details -->
              <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;margin-bottom:28px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="color:#6b7280;font-size:13px;">Paid by</span>
                  <span style="color:#d1d5db;font-size:13px;font-weight:600;">${ownerName || user.email}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="color:#6b7280;font-size:13px;">Your share</span>
                  <span style="color:#34ffb4;font-size:13px;font-weight:600;">₹${Number(amount).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <!-- CTA Button -->
              <a href="${appUrl}/splits" style="display:block;text-align:center;background:linear-gradient(135deg,#34ffb4,#00d4aa);color:#060a12;font-weight:900;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;padding:16px 24px;border-radius:14px;text-decoration:none;margin-bottom:16px;">
                ✅ Settle Up Now
              </a>

              <p style="color:#374151;text-align:center;font-size:12px;margin:0;">
                Not on Expense Monitor yet? <a href="${appUrl}/auth" style="color:#34ffb4;text-decoration:none;">Sign up free</a> to track & settle debts easily.
              </p>
            </div>

            <!-- Footer -->
            <p style="color:#374151;text-align:center;font-size:11px;margin:24px 0 0;">
              This notification was sent by ${ownerName || user.email} via Expense Monitor.<br>
              If you didn't expect this, you can safely ignore it.
            </p>
          </div>
        </body>
        </html>
      `;

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Expense Monitor <noreply@expensemonitor.tech>',
          to: [friendEmail],
          subject: `💸 ${ownerName || 'Someone'} says you owe ₹${Number(amount).toLocaleString('en-IN')}`,
          html: emailHtml
        })
      });

      if (!resendResponse.ok) {
        const resendData = await resendResponse.json();
        throw new Error(resendData.message || 'Failed to send email via Resend');
      }
    }

    return res.status(200).json({ 
      success: true, 
      inApp: !!friendUser,
      message: 'Friend notified successfully!' 
    });

  } catch (err) {
    console.error('Split notify error:', err);
    return res.status(500).json({ error: err.message });
  }
}
