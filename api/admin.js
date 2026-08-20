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

  // 🔍 ACTION: Check if username is taken
  if (action === 'checkUsername') {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Username required' });
    
    try {
      const { data, error } = await supabase.auth.admin.listUsers();
      if (error) throw error;
      
      const requestedUsername = username.toLowerCase().trim();
      const isTaken = data.users.some(u => 
        u.user_metadata?.username?.toLowerCase() === requestedUsername
      );
      
      return res.status(200).json({ taken: isTaken });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
