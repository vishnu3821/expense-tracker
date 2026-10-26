import { format } from 'date-fns';

/**
 * Smart parser for Indian Bank / UPI transaction SMS
 * Extracts Amount, Merchant, Category, Transaction ID, and Date.
 */
export function parseBankSms(text, smartCategoriesMap = {}) {
  if (!text || typeof text !== 'string') return null;

  const raw = text.trim();
  const lower = raw.toLowerCase();

  // 1. Amount Extraction
  // Handles: "Rs. 350.00", "Rs 350", "INR 1,250.50", "₹450", "debited by Rs 350"
  let amount = '';
  const amountMatch = raw.match(/(?:Rs\.?|INR|₹|debited\s*(?:by|with)?\s*(?:Rs\.?|INR|₹)?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
                     raw.match(/([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:debited|spent|paid)/i);
  if (amountMatch) {
    amount = amountMatch[1].replace(/,/g, '');
  }

  // 2. Merchant / Receiver Extraction
  let merchant = '';
  const merchantMatch = raw.match(/(?:for|at|to|towards|vpa|paid to|info:?)\s+([A-Za-z0-9\s&'.-]{2,30}?)(?:\s+on|\s+using|\s+ref|\s+upi|\s+a\/c|\s+txn|\s+via|\.|\n|,|$)/i);
  if (merchantMatch) {
    const candidate = merchantMatch[1].trim();
    // Exclude generic bank keywords
    if (!/^(a\/c|account|credit|debit|bank|card|user|vpa|transfer)$/i.test(candidate)) {
      merchant = candidate;
    }
  }

  // Known merchant database with accurate categories
  const knownMerchants = [
    { key: 'swiggy', name: 'Swiggy', cat: 'Food & Dining' },
    { key: 'zomato', name: 'Zomato', cat: 'Food & Dining' },
    { key: 'blinkit', name: 'Blinkit', cat: 'Food & Dining' },
    { key: 'zepto', name: 'Zepto', cat: 'Food & Dining' },
    { key: 'instamart', name: 'Swiggy Instamart', cat: 'Food & Dining' },
    { key: 'starbucks', name: 'Starbucks', cat: 'Food & Dining' },
    { key: 'mcdonald', name: "McDonald's", cat: 'Food & Dining' },
    { key: 'kfc', name: 'KFC', cat: 'Food & Dining' },
    { key: 'domino', name: "Domino's Pizza", cat: 'Food & Dining' },
    { key: 'burger king', name: 'Burger King', cat: 'Food & Dining' },
    { key: 'pizza hut', name: 'Pizza Hut', cat: 'Food & Dining' },
    { key: 'uber', name: 'Uber', cat: 'Transport' },
    { key: 'ola', name: 'Ola Cabs', cat: 'Transport' },
    { key: 'rapido', name: 'Rapido', cat: 'Transport' },
    { key: 'petrol', name: 'Petrol / Fuel', cat: 'Transport' },
    { key: 'fuel', name: 'Fuel', cat: 'Transport' },
    { key: 'irctc', name: 'IRCTC Train Ticket', cat: 'Transport' },
    { key: 'metro', name: 'Metro Recharge', cat: 'Transport' },
    { key: 'amazon', name: 'Amazon', cat: 'Shopping' },
    { key: 'flipkart', name: 'Flipkart', cat: 'Shopping' },
    { key: 'myntra', name: 'Myntra', cat: 'Shopping' },
    { key: 'ajio', name: 'Ajio', cat: 'Shopping' },
    { key: 'nykaa', name: 'Nykaa', cat: 'Shopping' },
    { key: 'netflix', name: 'Netflix', cat: 'Entertainment' },
    { key: 'spotify', name: 'Spotify', cat: 'Entertainment' },
    { key: 'prime', name: 'Amazon Prime', cat: 'Entertainment' },
    { key: 'bookmyshow', name: 'BookMyShow', cat: 'Entertainment' },
    { key: 'pvr', name: 'PVR Cinemas', cat: 'Entertainment' },
    { key: 'airtel', name: 'Airtel Bill / Recharge', cat: 'Utilities' },
    { key: 'jio', name: 'Jio Bill / Recharge', cat: 'Utilities' },
    { key: 'vi', name: 'Vodafone Idea', cat: 'Utilities' },
    { key: 'electricity', name: 'Electricity Bill', cat: 'Utilities' },
    { key: 'bescom', name: 'Electricity Bill', cat: 'Utilities' },
    { key: 'tneb', name: 'Electricity Bill', cat: 'Utilities' },
    { key: 'apollo', name: 'Apollo Pharmacy', cat: 'Health' },
    { key: 'pharmeasy', name: 'PharmEasy', cat: 'Health' },
    { key: '1mg', name: 'Tata 1mg', cat: 'Health' },
    { key: 'hospital', name: 'Hospital / Medical', cat: 'Health' }
  ];

  let detectedCategory = 'Other';

  for (const km of knownMerchants) {
    if (lower.includes(km.key)) {
      if (!merchant || merchant.length < 3) {
        merchant = km.name;
      }
      detectedCategory = km.cat;
      break;
    }
  }

  // Fallback category matching using custom SMART_CATEGORIES
  if (detectedCategory === 'Other') {
    for (const [kw, cat] of Object.entries(smartCategoriesMap)) {
      if (lower.includes(kw.toLowerCase())) {
        detectedCategory = cat;
        break;
      }
    }
  }

  // 3. Transaction ID / UPI Ref
  let transactionId = '';
  const txnMatch = raw.match(/(?:UTR|UPI Ref|Txn ID|Transaction ID|Ref No|Reference)[^0-9a-zA-Z]*([a-zA-Z0-9]{8,18})/i);
  if (txnMatch) {
    transactionId = txnMatch[1];
  }

  // 4. Date Extraction
  let date = format(new Date(), 'yyyy-MM-dd');
  const dateMatch = raw.match(/(?:on\s+)?(\d{1,2})[-/](\d{1,2}|[A-Za-z]{3})[-/](\d{2,4})/);
  if (dateMatch) {
    try {
      const day = dateMatch[1].padStart(2, '0');
      let month = dateMatch[2];
      const monthNames = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
      if (monthNames[month.toLowerCase()]) {
        month = monthNames[month.toLowerCase()];
      } else {
        month = month.padStart(2, '0');
      }
      let year = dateMatch[3];
      if (year.length === 2) year = '20' + year;
      date = `${year}-${month}-${day}`;
    } catch {
      // Keep today's date on parse error
    }
  }

  // Clean up merchant name (strip trailing punctuation and whitespace)
  if (merchant) {
    merchant = merchant.replace(/[,.-]+$/, '').trim();
    // Capitalize first letters
    merchant = merchant.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  return {
    amount,
    merchant: merchant || 'Bank Debit',
    category: detectedCategory,
    transactionId,
    date,
    paymentMode: 'UPI'
  };
}
