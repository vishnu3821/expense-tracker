const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@expensemonitor.tech';
const FROM_NAME = 'Orbit Finance';

Deno.serve(async (req: Request) => {
  // Supabase sends a POST with the auth hook payload
  const payload = await req.json();

  const { user, email_data } = payload;
  const { token, email_action_type } = email_data;
  const toEmail = user.email;

  // Build email content based on action type
  let subject = 'Your Sign In Code — Orbit Finance';
  let html = `
    <div style="font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; background: #060a12; color: #eef4f2; padding: 40px; border-radius: 16px;">
      <h1 style="font-size: 28px; font-weight: 800; margin: 0 0 8px; color: #34ffb4;">Orbit Finance</h1>
      <p style="color: #8b96a6; margin: 0 0 32px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em;">Know where every rupee goes</p>
      <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 16px;">Your sign-in code</h2>
      <p style="color: #8b96a6; font-size: 15px; margin: 0 0 28px;">Enter this 6-digit code to sign in to your account:</p>
      <div style="background: rgba(52,255,180,0.08); border: 1px solid rgba(52,255,180,0.2); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
        <span style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #34ffb4; font-variant-numeric: tabular-nums;">${token}</span>
      </div>
      <p style="color: #5c6675; font-size: 13px; margin: 0;">This code expires in <strong style="color:#8b96a6;">10 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  if (email_action_type === 'signup') {
    subject = 'Verify your email — Orbit Finance';
    html = html.replace('Your sign-in code', 'Verify your email').replace('sign in to your account', 'verify your email address');
  } else if (email_action_type === 'recovery') {
    subject = 'Reset your password — Orbit Finance';
    html = html.replace('Your sign-in code', 'Password reset code').replace('sign in to your account', 'reset your password');
  }

  // Send via Resend HTTP API
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [toEmail],
      subject,
      html,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('Resend error:', data);
    return new Response(JSON.stringify({ error: data }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, id: data.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
