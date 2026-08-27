import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const { action, userId } = req.query;

  // 🛡️ Security Check: Require and verify JWT token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized. Invalid token.' });
  }

  // 🛡️ Admin Verification: Ensure the user's email matches the admin email
  if (user.email !== 'p.vishnuprabhakar@gmail.com') {
    return res.status(403).json({ error: 'Forbidden. Admin access only.' });
  }

  // 📂 ACTION: List all users
  if (action === 'listUsers') {
    try {
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) throw error;

      const userStatsPromises = (data.users || []).map(async (u) => {
        const { count, error: countError } = await supabase
          .from('expenses')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', u.id);

        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          transaction_count: countError ? 0 : count
        };
      });

      const userStats = await Promise.all(userStatsPromises);

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

  // 🧑‍💻 ACTION: Migrate users to have usernames
  if (action === 'migrateUsernames') {
    try {
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) throw error;
      
      let migratedCount = 0;
      for (const u of data.users) {
        if (!u.user_metadata?.username) {
          // Generate a username
          let baseName = '';
          if (u.user_metadata?.full_name) {
             baseName = u.user_metadata.full_name.toLowerCase().replace(/[^a-z0-9]/g, '');
          } else if (u.user_metadata?.name) {
             baseName = u.user_metadata.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          } else {
             baseName = u.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          }
          
          const randomSuffix = Math.floor(100 + Math.random() * 900);
          const newUsername = `@${baseName}${randomSuffix}`;
          
          await supabase.auth.admin.updateUserById(u.id, {
             user_metadata: { ...u.user_metadata, username: newUsername }
          });
          migratedCount++;
        }
      }
      return res.status(200).json({ success: true, migratedCount });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
