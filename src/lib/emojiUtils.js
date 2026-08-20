export const EMOJI_MAP = {
  // Food & Dining
  'zomato': '🍔',
  'swiggy': '🛵',
  'kfc': '🍗',
  'mcdonalds': '🍟',
  'mcd': '🍟',
  'pizza': '🍕',
  'burger': '🍔',
  'coffee': '☕',
  'tea': '🍵',
  'chai': '☕',
  'restaurant': '🍽️',
  'dinner': '🍝',
  'lunch': '🍱',
  'breakfast': '🥐',
  'cafe': '☕',
  'ice cream': '🍦',
  'cake': '🍰',
  'bakery': '🧁',
  'water': '💧',
  'groceries': '🛒',
  'supermarket': '🏪',

  // Transport
  'uber': '🚕',
  'ola': '🚕',
  'rapido': '🏍️',
  'petrol': '⛽',
  'fuel': '⛽',
  'diesel': '⛽',
  'flight': '✈️',
  'train': '🚆',
  'irctc': '🚆',
  'bus': '🚌',
  'metro': '🚇',
  'auto': '🛺',
  'cab': '🚖',

  // Entertainment & Subs
  'netflix': '🍿',
  'spotify': '🎵',
  'prime': '📦',
  'movie': '🎬',
  'cinema': '🍿',
  'game': '🎮',
  'steam': '🎮',
  'psn': '🎮',
  'xbox': '🎮',

  // Shopping
  'amazon': '📦',
  'flipkart': '🛍️',
  'myntra': '👗',
  'zara': '👕',
  'hm': '👕',
  'shopping': '🛍️',
  'clothes': '👔',
  'shoes': '👟',
  'gift': '🎁',

  // Utilities & Bills
  'electricity': '⚡',
  'wifi': '📶',
  'internet': '🌐',
  'jio': '📱',
  'airtel': '📱',
  'recharge': '📱',
  'phone': '📱',
  'water bill': '🚰',
  'gas': '🔥',
  'rent': '🏠',

  // Health
  'pharmacy': '💊',
  'medicine': '💊',
  'hospital': '🏥',
  'doctor': '🩺',
  'gym': '💪',
  'workout': '🏋️',
};

export const getExpenseNameWithEmoji = (name) => {
  if (!name) return name;
  const lowerName = name.toLowerCase().trim();
  
  // Check if name already starts with an emoji (basic check)
  // Emojis typically fall out of the standard ASCII range
  const firstChar = name.trim().charAt(0);
  const isEmoji = firstChar.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
  if (isEmoji) return name; // Already has emoji, return as is

  // Find matching emoji
  for (const [keyword, emoji] of Object.entries(EMOJI_MAP)) {
    if (lowerName.includes(keyword)) {
      return `${emoji} ${name}`;
    }
  }

  // Optional generic fallback based on words or just return name
  return name;
};
