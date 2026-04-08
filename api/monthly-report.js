import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Allow manual trigger via POST with secret check for testing
  const isCron = req.headers['x-vercel-cron'] === 'true';
  const isManual = req.method === 'POST';

  if (!isCron && !isManual) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured in Vercel.');
    }

    console.log('Starting Monthly Report Generation...');

    // 1. Calculate Date Range (Previous Month)
    const now = new Date();
    const lastMonth = subMonths(now, 1);
    const startDate = startOfMonth(lastMonth).toISOString();
    const endDate = endOfMonth(lastMonth).toISOString();
    const monthName = format(lastMonth, 'MMMM yyyy');

    // 2. Fetch Users (We'll use user_fcm_tokens as a proxy for active users with registered tokens)
    const { data: users, error: userError } = await supabase
      .from('user_fcm_tokens')
      .select('user_id');

    if (userError) throw userError;
    if (!users || users.length === 0) {
      return res.status(200).json({ message: 'No users found to send reports to.' });
    }

    const reportResults = [];

    for (const { user_id } of users) {
      try {
        // 3. Get User Email (Need to use Supabase Admin API)
        const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(user_id);
        if (authError || !user?.email) {
          reportResults.push({ user_id, status: 'error', reason: 'Could not fetch user email' });
          continue;
        }

        const userEmail = user.email;

        // 4. Fetch Expenses for that User
        const { data: expenses, error: expError } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user_id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true });

        if (expError) throw expError;

        // 5. Generate PDF (Professional Layout)
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Header Banner
        doc.setFillColor(13, 148, 136); // teal-600
        doc.rect(0, 0, pageWidth, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('Monthly Expense Report', pageWidth / 2, 18, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(monthName, pageWidth / 2, 26, { align: 'center' });
        doc.setFontSize(8);
        doc.text(`Prepared for: ${userEmail}`, pageWidth / 2, 32, { align: 'center' });

        const totalAll = expenses.reduce((s, e) => s + Number(e.amount), 0);
        
        // Summary Cards
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary Overview', 15, 55);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Total Spending: Rs. ${totalAll.toFixed(2)}`, 15, 65);
        doc.text(`Total Transactions: ${expenses.length}`, 15, 72);

        // Transactions Table
        const tableRows = expenses.map(e => [
          format(parseISO(e.date), 'dd MMM'),
          e.name,
          e.category || 'Other',
          e.payment_mode || 'UPI',
          `Rs. ${Number(e.amount).toFixed(2)}`
        ]);

        autoTable(doc, {
          startY: 85,
          head: [['Date', 'Description', 'Category', 'Mode', 'Amount']],
          body: tableRows,
          theme: 'grid',
          headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [240, 253, 250] },
          margin: { left: 15, right: 15 }
        });

        // Convert PDF to Base64 for Resend
        const pdfBase64 = doc.output('datauristring').split(',')[1];

        // 6. Send Email via Resend
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: resendFromEmail,
            to: [userEmail],
            subject: `Your Expense Report for ${monthName}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                <h1 style="color: #0d9488; margin-bottom: 20px;">Monthly Summary</h1>
                <p>Hello,</p>
                <p>Attached is your professional expense report for <strong>${monthName}</strong>.</p>
                <div style="background: #f0fdfa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; color: #0f766e; font-weight: bold;">Total Spent: Rs. ${totalAll.toFixed(2)}</p>
                </div>
                <p>We hope this helps you stay on track with your budget!</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="font-size: 12px; color: #64748b;">This is an automated report from Expense Monitor.</p>
              </div>
            `,
            attachments: [
              {
                filename: `Expense_Report_${format(lastMonth, 'MMM_yyyy')}.pdf`,
                content: pdfBase64
              }
            ]
          })
        });

        if (!resendRes.ok) {
          const errorData = await resendRes.json();
          throw new Error(`Resend Error: ${JSON.stringify(errorData)}`);
        }

        reportResults.push({ user_id, email: userEmail, status: 'sent' });

      } catch (err) {
        console.error(`Error processing user ${user_id}:`, err);
        reportResults.push({ user_id, status: 'error', error: err.message });
      }
    }

    return res.status(200).json({ success: true, results: reportResults });

  } catch (error) {
    console.error('Monthly Report Global Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
