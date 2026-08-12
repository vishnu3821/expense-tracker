const text = "Wed | 11.56 @ SN al FT < < Payment successful to Venkata Vara Lakshmi > oe LJ - . You earned 1.5% c";

const superMoneyMatch = text.match(/Payment successful\s*to\s*([A-Za-z\s]+?)\s*(?:₹|>|oe|You earned|Rs)/is);
console.log("Super money match:", superMoneyMatch ? superMoneyMatch[1] : "NO MATCH");
