import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const { action, userId, adminEmail } = req.query;

  // 🛡️ Security Check: Only allow the specific admin email
  if (!adminEmail || adminEmail !== 'p.vishnuprabhakar@gmail.com') {
    return res.status(403).json({ error: 'Unauthorized. Admin access only.' });
  }

  // 📂 ACTION: List all users
  if (action === 'listUsers') {
    try {
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) throw error;

      // Also get transaction counts for each user to show in the list
      const { data: expenses, error: expError } = await supabase
        .from('expenses')
        .select('user_id');
      
      if (expError) throw expError;

      const userStats = (data.users || []).map(u => {
        const count = expenses.filter(e => e.user_id === u.id).length;
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          transaction_count: count
        };
      });

      return res.status(200).json({ users: userStats });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 🧾 ACTION: Get detailed expenses for a specific user
  if (action === 'getUserExpenses') {
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ expenses: data || [] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
