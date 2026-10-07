import { createClient } from '@supabase/supabase-js';
import { parseISO, startOfDay, startOfMonth } from 'date-fns';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data } = await supabase.from('expenses').select('id, amount, date, created_at, category').order('date', { ascending: false }).limit(20);
  console.log("Last 20 expenses:", data);
  const now = new Date();
  const today = startOfDay(now);
  const monthStart = startOfMonth(now);
  console.log("Now:", now);
  console.log("Today:", today);
  console.log("Month Start:", monthStart);
  
  let todayTotal = 0;
  let monthTotal = 0;
  
  data.forEach(expense => {
    const expenseDate = parseISO(expense.date);
    const amount = Number(expense.amount);
    
    if (expense.category !== 'Transfer') {
        if (expenseDate >= today) todayTotal += amount;
        if (expenseDate >= monthStart) monthTotal += amount;
    }
  });
  console.log("Today total:", todayTotal, "Month total:", monthTotal);
}
test();
