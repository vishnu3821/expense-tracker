import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { query } = req.query;
  if (!query || query.length < 3) {
    return res.status(400).json({ error: 'Search query must be at least 3 characters' });
  }

  try {
    const { data: allUsers, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;

    const searchTerm = query.toLowerCase().trim();
    
    // Filter users whose username matches the search query (and exclude the current user)
    const matches = allUsers.users.filter(u => 
      u.id !== user.id && 
      u.user_metadata?.username &&
      u.user_metadata.username.toLowerCase().includes(searchTerm)
    ).map(u => ({
      id: u.id,
      username: u.user_metadata.username,
      email: u.email
    }));

    // Limit to top 10 results
    return res.status(200).json({ users: matches.slice(0, 10) });

  } catch (err) {
    console.error('Search users error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
