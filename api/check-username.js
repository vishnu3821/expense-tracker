import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
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
    return res.status(500).json({ error: 'Internal server error while checking username' });
  }
}
