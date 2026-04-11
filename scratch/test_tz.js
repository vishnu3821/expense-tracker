const simulateTodayStart = (nowDate) => {
    const now = new Date(nowDate);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const istStartOfDay = new Date(Date.UTC(
      istNow.getUTCFullYear(),
      istNow.getUTCMonth(),
      istNow.getUTCDate()
    ));
    const todayStart = new Date(istStartOfDay.getTime() - istOffset).toISOString();
    return todayStart;
};

const testCases = [
    "2024-04-11T15:30:00Z", // 9:00 PM IST on April 11
    "2024-04-11T18:30:00Z", // 12:00 AM IST on April 12
    "2024-04-12T00:00:00Z", // 5:30 AM IST on April 12
    "2024-04-11T05:00:00Z", // 10:30 AM IST on April 11
];

testCases.forEach(tc => {
    console.log(`Now (UTC): ${tc}`);
    console.log(`IST Start (UTC): ${simulateTodayStart(tc)}`);
    console.log('---');
});
