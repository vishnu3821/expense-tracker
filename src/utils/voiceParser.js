// Utility functions for parsing speech-to-text in the Step-by-Step Voice Assistant

// Word to number conversion mapping
const SMALL_NUMBERS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19
};

const TENS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
};

const MAGNITUDES = {
  hundred: 100,
  thousand: 1000,
  k: 1000,
  lakh: 100000,
  lac: 100000,
  lakhs: 100000,
  crore: 10000000,
  crores: 10000000
};

/**
 * Extracts a numeric amount from spoken text.
 * Handles digits (e.g. "490", "1500.50"), colloquial pairs ("four ninety" -> 490, "two fifty" -> 250),
 * "k" notation ("1.5k" -> 1500), currency labels, and full English words ("four hundred ninety").
 */
export function extractAmountFromVoice(transcript) {
  if (!transcript || typeof transcript !== 'string') return null;

  const raw = transcript.toLowerCase().trim();

  // 1. Direct number with 'k' notation like "1.5k" or "2.5 k"
  const kMatch = raw.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1]) * 1000;
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. Direct digits inside the text (e.g. "490", "490 rupees", "₹ 1200", "50.50")
  // Find all sequences of digits, pick the best candidate
  const digitMatches = raw.match(/\b\d+(?:[.,]\d{1,2})?\b/g);
  if (digitMatches && digitMatches.length > 0) {
    // Pick the last or largest numeric token found
    for (let i = digitMatches.length - 1; i >= 0; i--) {
      const cleanNum = digitMatches[i].replace(/,/g, '');
      const parsed = parseFloat(cleanNum);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  // 3. Fallback: Parse spoken English words ("four hundred fifty", "four ninety", "two thousand")
  // Tokenize words, removing punctuation
  const words = raw.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

  // Check for colloquial pairs like "four ninety" -> 490, "two fifty" -> 250, "three twenty" -> 320
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i];
    const w2 = words[i + 1];
    if (SMALL_NUMBERS[w1] !== undefined && SMALL_NUMBERS[w1] >= 1 && SMALL_NUMBERS[w1] <= 9 && TENS[w2] !== undefined) {
      // e.g. "four ninety" => 4 * 100 + 90 = 490
      const val = (SMALL_NUMBERS[w1] * 100) + TENS[w2];
      // Check if there is a trailing small number e.g. "four ninety five" => 495
      if (i + 2 < words.length && SMALL_NUMBERS[words[i + 2]] !== undefined) {
        return val + SMALL_NUMBERS[words[i + 2]];
      }
      return val;
    }
  }

  let total = 0;
  let current = 0;
  let foundAnyNumber = false;

  for (const word of words) {
    if (word === 'and') continue;

    if (SMALL_NUMBERS[word] !== undefined) {
      current += SMALL_NUMBERS[word];
      foundAnyNumber = true;
    } else if (TENS[word] !== undefined) {
      current += TENS[word];
      foundAnyNumber = true;
    } else if (MAGNITUDES[word] !== undefined) {
      const mag = MAGNITUDES[word];
      foundAnyNumber = true;
      if (current === 0) current = 1;
      if (mag === 100) {
        current *= 100;
      } else {
        total += current * mag;
        current = 0;
      }
    }
  }

  total += current;
  if (foundAnyNumber && total > 0) {
    return total;
  }

  return null;
}

/**
 * Standard app categories with keywords for voice matching
 */
export const CATEGORY_DEFINITIONS = [
  {
    name: 'Food & Dining',
    icon: 'Utensils',
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    keywords: [
      'food', 'dining', 'dinner', 'lunch', 'breakfast', 'brunch', 'cafe', 'coffee', 'tea', 'chai',
      'swiggy', 'zomato', 'restaurant', 'mcdonalds', 'kfc', 'burger', 'pizza', 'biryani', 'snacks',
      'eating', 'drinks', 'bar', 'pub', 'bakery', 'starbucks', 'dominos', 'subway', 'ice cream',
      'dessert', 'meals', 'eat', 'beverage', 'groceries', 'supermarket', 'blinkit', 'zepto', 'instamart'
    ]
  },
  {
    name: 'Transport',
    icon: 'Car',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    keywords: [
      'transport', 'travel', 'petrol', 'fuel', 'diesel', 'cng', 'uber', 'ola', 'rapido', 'taxi',
      'cab', 'auto', 'metro', 'bus', 'train', 'flight', 'ticket', 'toll', 'parking', 'fastag',
      'gas', 'railway', 'commute', 'ride', 'air'
    ]
  },
  {
    name: 'Shopping',
    icon: 'ShoppingBag',
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    keywords: [
      'shopping', 'clothes', 'clothing', 'shirt', 'pants', 'shoes', 'dress', 'amazon', 'flipkart',
      'myntra', 'zara', 'h&m', 'mall', 'electronics', 'gadget', 'mobile', 'laptop', 'store',
      'purchase', 'bought', 'accessories', 'retail', 'jewellery', 'watch'
    ]
  },
  {
    name: 'Entertainment',
    icon: 'Film',
    color: 'from-pink-500 to-rose-500',
    bgColor: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
    keywords: [
      'entertainment', 'movie', 'movies', 'cinema', 'pvr', 'inox', 'netflix', 'spotify', 'hotstar',
      'prime', 'youtube', 'gaming', 'games', 'game', 'concert', 'show', 'party', 'outing', 'club',
      'fun', 'amusement'
    ]
  },
  {
    name: 'Utilities',
    icon: 'Zap',
    color: 'from-amber-500 to-yellow-500',
    bgColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    keywords: [
      'utilities', 'bills', 'bill', 'electricity', 'current', 'power', 'water', 'wifi', 'internet',
      'broadband', 'recharge', 'mobile recharge', 'jio', 'airtel', 'vi', 'cylinder', 'gas bill',
      'maintenance', 'subscription'
    ]
  },
  {
    name: 'Health',
    icon: 'HeartPulse',
    color: 'from-red-500 to-rose-500',
    bgColor: 'bg-red-500/10 text-red-400 border-red-500/30',
    keywords: [
      'health', 'wellness', 'spa', 'yoga', 'medical', 'medicine', 'medicines', 'pharmacy',
      'doctor', 'hospital', 'clinic', 'gym', 'fitness', 'workout', 'tablets', 'apollo',
      'consultation', 'test', 'lab', 'dental', 'dentist', 'skincare', 'therapy', 'massage',
      'supplements', 'protein', 'treatment', 'ayurveda'
    ]
  },
  {
    name: 'Housing',
    icon: 'Home',
    color: 'from-indigo-500 to-blue-500',
    bgColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    keywords: [
      'housing', 'house', 'rent', 'flat', 'apartment', 'pg', 'brokerage', 'room', 'deposit',
      'furniture', 'decor', 'repair', 'home', 'renovation'
    ]
  },
  {
    name: 'Other',
    icon: 'MoreHorizontal',
    color: 'from-slate-500 to-zinc-500',
    bgColor: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    keywords: ['other', 'misc', 'general', 'miscellaneous', 'cash', 'transfer', 'donation', 'gift', 'fees', 'personal']
  }
];

/**
 * Matches spoken category text against our category definitions.
 */
export function parseVoiceCategory(transcript) {
  if (!transcript || typeof transcript !== 'string') return null;
  const raw = transcript.toLowerCase().trim();

  // Check exact category names first
  for (const cat of CATEGORY_DEFINITIONS) {
    if (raw.includes(cat.name.toLowerCase())) {
      return cat.name;
    }
  }

  // Check keywords
  for (const cat of CATEGORY_DEFINITIONS) {
    for (const kw of cat.keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(raw)) {
        return cat.name;
      }
    }
  }

  return null;
}

/**
 * Predicts category from expense name/title (e.g. "Swiggy order" -> "Food & Dining")
 */
export function inferCategoryFromName(name) {
  if (!name || typeof name !== 'string') return 'Other';
  const raw = name.toLowerCase().trim();

  for (const cat of CATEGORY_DEFINITIONS) {
    for (const kw of cat.keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(raw)) {
        return cat.name;
      }
    }
  }

  return 'Other';
}

/**
 * Parses spoken date ("today", "yesterday", "day before yesterday", etc.)
 * Returns YYYY-MM-DD format string.
 */
export function parseVoiceDate(transcript) {
  const now = new Date();
  const formatYYYYMMDD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (!transcript || typeof transcript !== 'string') {
    return formatYYYYMMDD(now);
  }

  const raw = transcript.toLowerCase().trim();

  if (raw.includes('day before yesterday')) {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return formatYYYYMMDD(d);
  }

  if (raw.includes('yesterday') || raw.includes('kal')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatYYYYMMDD(d);
  }

  if (raw.includes('today') || raw.includes('aaj') || raw.includes('now') || raw.includes('just now')) {
    return formatYYYYMMDD(now);
  }

  return formatYYYYMMDD(now);
}

/**
 * Cleans user spoken text to produce a clean expense title.
 * Strips trigger words like "spent on", "paid for", "bought", etc.
 */
export function cleanExpenseName(transcript) {
  if (!transcript) return '';
  let cleaned = transcript
    .replace(/^(spent\s*(on|for)?|paid\s*(for|to)?|bought|purchased|bill\s*for)\s+/i, '')
    .replace(/\s+(rupees|rs|inr|bucks).*$/i, '')
    .trim();

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}
