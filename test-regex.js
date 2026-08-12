const ocrOutputs = [
  // PhonePe
  `Transaction Successful
  10:51 am on 12 Aug 2026
  Paid to
  DC
  D HIDDEN CAFE ₹40
  SBIBHIM.INSTANT...
  Transfer Details
  Message
  PhonePe Transaction ID
  T2608121051021821914337
  `,
  // GPay
  `To KL UNIVERSITY VADDESWARAM SB
  ₹20
  Completed
  16 Jun 2026, 1:16 pm
  UPI transaction ID
  616756789668
  To: KL UNIVERSITY VADDESWARAM SB
  From: Pedasanaganti Vishnu Prabhakar
  `,
  // Paytm
  `Paid Successfully
  Amount
  ₹40
  Rupees Forty Only
  Education Edit
  To
  KI University Vaddeswaram Sb
  UPI ID: ...
  `,
  // Super Money
  `Payment successful
  to Venkata Vara Lakshmi
  ₹10
  You earned 1.5% cashback
  10 July 2026
  UPI Transaction ID: 655779445605
  `
];

function extractName(text) {
  // 1. PhonePe: "Paid to \n [Name] \n ₹" or "Paid to \n DC \n [Name]"
  const phonePeMatch = text.match(/Paid to\s*(?:DC\s*)?([A-Za-z0-9\s]+?)\s*₹/is);
  if (phonePeMatch) return phonePeMatch[1].trim();

  // 2. Super Money: "Payment successful \n to [Name] \n ₹"
  const superMoneyMatch = text.match(/Payment successful\s*to\s*([A-Za-z0-9\s]+?)\s*₹/is);
  if (superMoneyMatch) return superMoneyMatch[1].trim();

  // 3. GPay: "To: [Name] \n From:" or "To [Name] \n ₹"
  const gpayMatch = text.match(/To:\s*([A-Za-z0-9\s]+?)\s*From:/is);
  if (gpayMatch) return gpayMatch[1].trim();
  
  const gpayMatch2 = text.match(/To\s+([A-Za-z0-9\s]+?)\s*₹/is);
  if (gpayMatch2) return gpayMatch2[1].trim();

  // 4. Paytm: "To \n [Name] \n UPI ID"
  const paytmMatch = text.match(/To\s*([A-Za-z0-9\s]+?)\s*UPI ID/is);
  if (paytmMatch) return paytmMatch[1].trim();
  
  return '';
}

for (const text of ocrOutputs) {
  console.log('--- TEST ---');
  let amount = '';
  const amountMatch = text.match(/(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (amountMatch) amount = amountMatch[1].replace(/,/g, '');

  let name = extractName(text);
  
  let txnId = '';
  const txnLabels = text.match(/(?:UTR|UPI Ref|Transaction ID|Txn ID|Ref No|Order ID|Reference)[^\w]*([\w]{8,})/i);
  if (txnLabels) txnId = txnLabels[1];

  console.log('Amount:', amount);
  console.log('Name:', name);
  console.log('Txn ID:', txnId);
}
