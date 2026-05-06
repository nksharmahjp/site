// ╔══════════════════════════════════════════════════════════════════════╗
// ║          NITESH AUTOMATIONS — TELEGRAM BOT                          ║
// ║          Google Apps Script | Version 1.0                           ║
// ║          Author: Nitesh Kumar                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// SETUP INSTRUCTIONS:
// 1. Go to script.google.com → New Project
// 2. Paste this entire code
// 3. Replace BOT_TOKEN with your actual BotFather token
// 4. Replace SPREADSHEET_ID with your Google Sheets ID
// 5. Replace ADMIN_CHAT_ID with your Telegram chat ID
// 6. Deploy as Web App (Execute as: Me, Access: Anyone)
// 7. Copy the Web App URL
// 8. Run setWebhook() function once to connect bot

// ═══════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════
const CONFIG = {
  BOT_TOKEN: "YOUR_BOT_TOKEN_HERE",        // BotFather से मिला token
  SPREADSHEET_ID: "YOUR_SHEET_ID_HERE",    // Google Sheets ID
  ADMIN_CHAT_ID: "YOUR_TELEGRAM_CHAT_ID",  // Admin का Telegram ID
  BOT_USERNAME: "@NiteshAutomationsBot",
  WEBSITE_URL: "https://niteshautomations.com",
  ANGEL_ONE_URL: "https://angel-one.onelink.me/Wjgr/referral",
  UPI_ID: "nitesh@upi",
  COMMISSION_RATE: 50,  // ₹ per referral
  MIN_WITHDRAWAL: 200,  // Minimum withdrawal amount
};

// API Base URL
const API_URL = `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}`;

// ═══════════════════════════════════════════
// SHEET NAMES
// ═══════════════════════════════════════════
const SHEETS = {
  USERS: "Users",
  REPORTS: "Reports", 
  PAYMENTS: "Payments",
  REFERRALS: "Referrals",
  CONTACT: "Contact",
  BROADCAST: "Broadcast",
};

// ═══════════════════════════════════════════
// MAIN WEBHOOK HANDLER
// ═══════════════════════════════════════════
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.message) {
      handleMessage(data.message);
    } else if (data.callback_query) {
      handleCallback(data.callback_query);
    }
    
    return ContentService.createTextOutput("OK");
  } catch (err) {
    Logger.log("Error in doPost: " + err.toString());
    return ContentService.createTextOutput("ERROR");
  }
}

// ═══════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════
function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const userId = msg.from.id;
  const firstName = msg.from.first_name || "User";
  const username = msg.from.username || "";
  
  // Command routing
  if (text.startsWith("/start")) {
    handleStart(chatId, userId, firstName, username, text);
  } else if (text === "/menu" || text === "🏠 Main Menu") {
    sendMainMenu(chatId, firstName);
  } else if (text === "/reports" || text === "📊 Reports देखें") {
    sendReportsList(chatId);
  } else if (text === "/demat" || text === "🏦 Demat Account खोलें") {
    sendDematInfo(chatId, userId);
  } else if (text === "/earnings" || text === "💰 My Earnings") {
    sendEarnings(chatId, userId);
  } else if (text === "/referral" || text === "👥 My Referrals") {
    sendReferralInfo(chatId, userId);
  } else if (text === "/support" || text === "📞 Support") {
    sendSupport(chatId);
  } else if (text === "/help") {
    sendHelp(chatId);
  } else if (text.startsWith("/broadcast") && chatId.toString() === CONFIG.ADMIN_CHAT_ID) {
    handleBroadcast(chatId, text);
  } else if (text.startsWith("/addreport") && chatId.toString() === CONFIG.ADMIN_CHAT_ID) {
    handleAddReport(chatId, text);
  } else if (text.startsWith("/stats") && chatId.toString() === CONFIG.ADMIN_CHAT_ID) {
    sendAdminStats(chatId);
  } else if (text.startsWith("/users") && chatId.toString() === CONFIG.ADMIN_CHAT_ID) {
    sendUsersList(chatId);
  } else {
    // Handle any unrecognized text
    handleUnknown(chatId, firstName);
  }
}

// ═══════════════════════════════════════════
// CALLBACK QUERY HANDLER
// ═══════════════════════════════════════════
function handleCallback(query) {
  const chatId = query.message.chat.id;
  const data = query.data;
  const userId = query.from.id;
  const firstName = query.from.first_name || "User";
  
  // Answer callback to remove loading
  answerCallback(query.id);
  
  if (data === "menu") {
    sendMainMenu(chatId, firstName);
  } else if (data === "reports") {
    sendReportsList(chatId);
  } else if (data === "demat") {
    sendDematInfo(chatId, userId);
  } else if (data === "earnings") {
    sendEarnings(chatId, userId);
  } else if (data === "referral") {
    sendReferralInfo(chatId, userId);
  } else if (data === "support") {
    sendSupport(chatId);
  } else if (data.startsWith("buy_")) {
    const reportId = data.replace("buy_", "");
    handleBuyReport(chatId, userId, firstName, reportId);
  } else if (data.startsWith("preview_")) {
    const reportId = data.replace("preview_", "");
    sendReportPreview(chatId, reportId);
  } else if (data.startsWith("pay_upi_")) {
    const reportId = data.replace("pay_upi_", "");
    sendUPIPayment(chatId, userId, reportId);
  } else if (data.startsWith("confirm_payment_")) {
    const parts = data.replace("confirm_payment_", "").split("_");
    confirmPayment(chatId, userId, firstName, parts[0], parts[1]);
  } else if (data === "angel_one") {
    sendAngelOneLink(chatId, userId);
  } else if (data === "withdraw") {
    handleWithdrawal(chatId, userId);
  } else if (data === "share_referral") {
    shareReferralLink(chatId, userId);
  }
}

// ═══════════════════════════════════════════
// /start HANDLER
// ═══════════════════════════════════════════
function handleStart(chatId, userId, firstName, username, text) {
  // Check for referral code in /start command
  const parts = text.split(" ");
  const refCode = parts.length > 1 ? parts[1] : null;
  
  // Register user if new
  const isNew = registerUser(userId, firstName, username, chatId, refCode);
  
  if (isNew && refCode) {
    // Process referral
    processReferral(refCode, userId);
  }
  
  const user = getUser(userId);
  const greeting = isNew ? "🎉 Welcome to Nitesh Automations!" : `✅ Welcome back, ${firstName}!`;
  
  const welcomeMsg = `
${greeting}

🌟 *Nitesh Automations* में आपका स्वागत है!

📈 *हम क्या provide करते हैं:*
• Stock Market Research Reports (Hindi & English)
• Expert fundamental & technical analysis
• Free Demat Account opening via Angel One
• Excel & Tally Automation services

${isNew ? `\n🎁 *आपका Referral Code:* \`NA-${userId.toString().slice(-6)}\`\nइस code को share करके ₹50 per referral कमाएं!\n` : ""}
नीचे menu से select करें 👇
  `;
  
  sendMessage(chatId, welcomeMsg, getMainMenuKeyboard());
}

// ═══════════════════════════════════════════
// MAIN MENU
// ═══════════════════════════════════════════
function sendMainMenu(chatId, firstName) {
  const msg = `
🏠 *Main Menu — Nitesh Automations*

नमस्ते ${firstName}! 👋

आप क्या करना चाहते हैं?
  `;
  sendMessage(chatId, msg, getMainMenuKeyboard());
}

function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📊 Research Reports", callback_data: "reports" },
        { text: "🏦 Free Demat Account", callback_data: "demat" }
      ],
      [
        { text: "💰 My Earnings", callback_data: "earnings" },
        { text: "👥 My Referrals", callback_data: "referral" }
      ],
      [
        { text: "📞 Support", callback_data: "support" },
        { text: "🌐 Website", url: CONFIG.WEBSITE_URL }
      ]
    ]
  };
}

// ═══════════════════════════════════════════
// REPORTS LIST
// ═══════════════════════════════════════════
function sendReportsList(chatId) {
  const reports = getReports();
  
  if (reports.length === 0) {
    sendMessage(chatId, "📊 अभी कोई report available नहीं है। जल्द ही आ रहे हैं!", getBackKeyboard());
    return;
  }
  
  let msg = "📊 *Available Research Reports*\n\n";
  
  const buttons = [];
  
  reports.forEach((r, i) => {
    msg += `*${i+1}. ${r.name}*\n`;
    msg += `   💰 Price: ₹${r.price}\n`;
    msg += `   🌐 Language: ${r.language}\n`;
    msg += `   📂 Sector: ${r.sector || 'General'}\n\n`;
    
    buttons.push([
      { text: `👁 Preview R${r.id}`, callback_data: `preview_${r.id}` },
      { text: `💳 Buy ₹${r.price}`, callback_data: `buy_${r.id}` }
    ]);
  });
  
  buttons.push([{ text: "🏠 Main Menu", callback_data: "menu" }]);
  
  sendMessage(chatId, msg, { inline_keyboard: buttons });
}

// ═══════════════════════════════════════════
// REPORT PREVIEW
// ═══════════════════════════════════════════
function sendReportPreview(chatId, reportId) {
  const report = getReportById(reportId);
  if (!report) { sendMessage(chatId, "Report नहीं मिली।", getBackKeyboard()); return; }
  
  const msg = `
📊 *${report.name}* — Preview

📌 *Report में क्या है:*
✅ Company Overview & Business Model
✅ Revenue & Profit Trends (5 Years)
✅ Market Position Analysis
🔒 Detailed Financial Analysis _(Paid)_
🔒 Valuation Metrics — P/E, P/B, ROE _(Paid)_
🔒 Target Price _(Paid)_
🔒 Risk Factors _(Paid)_
🔒 Investment Recommendation _(Paid)_

💰 *Price: ₹${report.price}* (Original: ₹${report.originalPrice || report.price*2})
🌐 *Language:* ${report.language}

⚠️ _यह content केवल educational purpose के लिए है। SEBI registered advice नहीं है।_
  `;
  
  sendMessage(chatId, msg, {
    inline_keyboard: [
      [{ text: `💳 Buy Full Report — ₹${report.price}`, callback_data: `buy_${reportId}` }],
      [{ text: "◀ Back to Reports", callback_data: "reports" }]
    ]
  });
}

// ═══════════════════════════════════════════
// BUY REPORT
// ═══════════════════════════════════════════
function handleBuyReport(chatId, userId, firstName, reportId) {
  const report = getReportById(reportId);
  if (!report) { sendMessage(chatId, "Report नहीं मिली।", getBackKeyboard()); return; }
  
  const msg = `
💳 *Payment — ${report.name}*

💰 Amount: *₹${report.price}*
👤 Name: ${firstName}
📊 Report: ${report.name}

Payment Method चुनें:
  `;
  
  sendMessage(chatId, msg, {
    inline_keyboard: [
      [{ text: "📱 UPI / QR Code", callback_data: `pay_upi_${reportId}` }],
      [{ text: "💳 Razorpay (Card/NetBanking)", url: `${CONFIG.WEBSITE_URL}/pay?report=${reportId}&user=${userId}` }],
      [{ text: "◀ Back", callback_data: "reports" }]
    ]
  });
}

// ═══════════════════════════════════════════
// UPI PAYMENT
// ═══════════════════════════════════════════
function sendUPIPayment(chatId, userId, reportId) {
  const report = getReportById(reportId);
  if (!report) return;
  
  const upiLink = `upi://pay?pa=${CONFIG.UPI_ID}&pn=NiteshAutomations&am=${report.price}&cu=INR&tn=Report_${reportId}`;
  
  const msg = `
📱 *UPI Payment Details*

💰 Amount: *₹${report.price}*
📊 Report: ${report.name}

*UPI ID:* \`${CONFIG.UPI_ID}\`

💡 *Steps:*
1. GPay / PhonePe / Paytm खोलें
2. UPI ID enter करें: \`${CONFIG.UPI_ID}\`
3. Amount: ₹${report.price} डालें
4. Note में: Report-${reportId} लिखें
5. Payment send करें
6. नीचे "Payment Done" button दबाएं

⏰ Payment verify होने में 5-10 minutes लगते हैं।
  `;
  
  sendMessage(chatId, msg, {
    inline_keyboard: [
      [{ text: "📱 Pay via UPI App", url: upiLink }],
      [{ text: "✅ Payment Done — Verify करें", callback_data: `confirm_payment_${reportId}_${userId}` }],
      [{ text: "◀ Back", callback_data: `buy_${reportId}` }]
    ]
  });
}

// ═══════════════════════════════════════════
// CONFIRM PAYMENT
// ═══════════════════════════════════════════
function confirmPayment(chatId, userId, firstName, reportId, payUserId) {
  const report = getReportById(reportId);
  if (!report) return;
  
  // Save pending payment to sheet
  savePendingPayment(userId, reportId, report.price);
  
  // Notify admin
  const adminMsg = `
🔔 *New Payment Verification Request*

👤 User: ${firstName} (${userId})
📊 Report: ${report.name}
💰 Amount: ₹${report.price}
⏰ Time: ${new Date().toLocaleString('en-IN')}

Please verify and approve:
  `;
  
  sendMessage(CONFIG.ADMIN_CHAT_ID, adminMsg, {
    inline_keyboard: [
      [
        { text: "✅ Approve & Send PDF", callback_data: `approve_${userId}_${reportId}` },
        { text: "❌ Reject", callback_data: `reject_${userId}_${reportId}` }
      ]
    ]
  });
  
  // Tell user
  const userMsg = `
✅ *Payment Verification Request Received!*

📊 Report: ${report.name}
💰 Amount: ₹${report.price}

⏰ हमारी team 5-10 minutes में verify करेगी।

✅ Approved होने पर आपको PDF download link मिलेगा।
❌ Payment fail होने पर refund process होगा।

🙏 धन्यवाद! Nitesh Automations
  `;
  
  sendMessage(chatId, userMsg, getBackKeyboard());
}

// ═══════════════════════════════════════════
// ANGEL ONE / DEMAT
// ═══════════════════════════════════════════
function sendDematInfo(chatId, userId) {
  const user = getUser(userId);
  const refCode = `NA-${userId.toString().slice(-6)}`;
  
  const msg = `
🏦 *Free Demat Account — Angel One*

✅ *Benefits:*
• Zero brokerage on delivery trades
• ₹0 Account Opening Fee
• Advanced trading tools
• Free research reports
• 24/7 customer support

📱 *Instant KYC:* सिर्फ 5 minutes में!

🔗 हमारे referral link से account खोलें और हमें support करें!

⚠️ _Disclaimer: यह एक referral link है। Investments market risk के अधीन हैं।_
  `;
  
  sendMessage(chatId, msg, {
    inline_keyboard: [
      [{ text: "🚀 Angel One में Account खोलें — FREE", url: CONFIG.ANGEL_ONE_URL }],
      [{ text: "📊 Research Reports देखें", callback_data: "reports" }],
      [{ text: "🏠 Main Menu", callback_data: "menu" }]
    ]
  });
  
  // Track click
  trackDematClick(userId);
}

function sendAngelOneLink(chatId, userId) {
  sendMessage(chatId, `🔗 *Angel One Referral Link:*\n\n${CONFIG.ANGEL_ONE_URL}\n\nऊपर दिए link से account खोलें!`);
}

// ═══════════════════════════════════════════
// EARNINGS
// ═══════════════════════════════════════════
function sendEarnings(chatId, userId) {
  const earnings = getUserEarnings(userId);
  
  const msg = `
💰 *My Earnings — Nitesh Automations*

👤 User ID: NA-${userId.toString().slice(-6)}

📊 *Earning Summary:*
• Total Earned: ₹${earnings.total || 0}
• Pending: ₹${earnings.pending || 0}
• Withdrawn: ₹${earnings.withdrawn || 0}

👥 *Referral Earnings:*
• Total Referrals: ${earnings.referralCount || 0}
• Commission Earned: ₹${earnings.referralEarnings || 0}
• Per Referral: ₹${CONFIG.COMMISSION_RATE}

💸 *Minimum Withdrawal: ₹${CONFIG.MIN_WITHDRAWAL}*

Withdrawal के लिए Support से contact करें।
  `;
  
  sendMessage(chatId, msg, {
    inline_keyboard: [
      [{ text: "💸 Withdrawal Request", callback_data: "withdraw" }],
      [{ text: "👥 My Referrals", callback_data: "referral" }],
      [{ text: "🏠 Main Menu", callback_data: "menu" }]
    ]
  });
}

// ═══════════════════════════════════════════
// REFERRAL SYSTEM
// ═══════════════════════════════════════════
function sendReferralInfo(chatId, userId) {
  const refCode = `NA-${userId.toString().slice(-6)}`;
  const refLink = `https://t.me/NiteshAutomationsBot?start=${refCode}`;
  const referrals = getUserReferrals(userId);
  
  const msg = `
👥 *My Referral Program*

🔗 *Your Referral Link:*
\`${refLink}\`

📊 *Your Stats:*
• Total Referrals: ${referrals.count || 0}
• Earnings: ₹${(referrals.count || 0) * CONFIG.COMMISSION_RATE}
• Per Referral: ₹${CONFIG.COMMISSION_RATE}

💡 *कैसे काम करता है:*
1. अपना referral link दोस्तों को share करें
2. वो link से register करें
3. आपको ₹${CONFIG.COMMISSION_RATE} commission मिलेगा
4. ₹${CONFIG.MIN_WITHDRAWAL} होने पर withdrawal करें

📢 *Share करें और कमाएं!*
  `;
  
  sendMessage(chatId, msg, {
    inline_keyboard: [
      [{ text: "📤 Referral Link Share करें", callback_data: "share_referral" }],
      [{ text: "💰 My Earnings", callback_data: "earnings" }],
      [{ text: "🏠 Main Menu", callback_data: "menu" }]
    ]
  });
}

function shareReferralLink(chatId, userId) {
  const refCode = `NA-${userId.toString().slice(-6)}`;
  const refLink = `https://t.me/NiteshAutomationsBot?start=${refCode}`;
  
  const shareText = `🚀 *Nitesh Automations में Join करें!*\n\nStock Market Research Reports, Free Demat Account, और बहुत कुछ!\n\n🔗 Join करें: ${refLink}\n\n📊 Professional stock analysis\n💰 Earn referral commission\n📱 Telegram Bot support`;
  
  sendMessage(chatId, `📤 यह message copy करके share करें:\n\n${shareText}`, getBackKeyboard());
}

// ═══════════════════════════════════════════
// SUPPORT
// ═══════════════════════════════════════════
function sendSupport(chatId) {
  const msg = `
📞 *Support — Nitesh Automations*

किसी भी issue के लिए contact करें:

📱 *WhatsApp:* +91 XXXXX XXXXX
📧 *Email:* nitesh@niteshautomations.com
✈ *Telegram:* @NiteshAutomations
⏰ *Working Hours:* Mon-Sat, 9 AM - 7 PM

🐛 *Common Issues:*
• Payment verify नहीं हुई
• PDF download नहीं हो रही
• Referral commission नहीं मिला
• Account login issue

👆 कोई भी issue message करें, हम 24 घंटे में reply करते हैं।

⚠️ _Disclaimer: Stock recommendations educational purpose के लिए हैं।_
  `;
  
  sendMessage(chatId, msg, {
    inline_keyboard: [
      [{ text: "📧 Message भेजें", url: "https://t.me/NiteshAutomations" }],
      [{ text: "🌐 Website Visit करें", url: CONFIG.WEBSITE_URL }],
      [{ text: "🏠 Main Menu", callback_data: "menu" }]
    ]
  });
}

// ═══════════════════════════════════════════
// HELP
// ═══════════════════════════════════════════
function sendHelp(chatId) {
  const msg = `
📖 *Bot Commands — Help*

/start — Bot start करें
/menu — Main menu खोलें
/reports — Available reports देखें
/demat — Free Demat account खोलें
/earnings — My earnings देखें
/referral — Referral info देखें
/support — Support contact करें

*Admin Commands:*
/broadcast [message] — All users को message
/addreport — New report add करें
/stats — Bot statistics देखें
/users — User list देखें

🤖 Powered by Nitesh Automations
  `;
  sendMessage(chatId, msg, getBackKeyboard());
}

// ═══════════════════════════════════════════
// ADMIN: BROADCAST
// ═══════════════════════════════════════════
function handleBroadcast(chatId, text) {
  const message = text.replace("/broadcast ", "").trim();
  if (!message) {
    sendMessage(chatId, "Usage: /broadcast [your message]");
    return;
  }
  
  const users = getAllUsers();
  let sent = 0, failed = 0;
  
  users.forEach(user => {
    try {
      sendMessage(user.telegramId, `📢 *Nitesh Automations — Announcement*\n\n${message}`);
      sent++;
      Utilities.sleep(50); // Rate limiting
    } catch(e) {
      failed++;
    }
  });
  
  sendMessage(chatId, `✅ Broadcast Complete!\n\n📤 Sent: ${sent}\n❌ Failed: ${failed}`);
}

// ═══════════════════════════════════════════
// ADMIN: ADD REPORT
// ═══════════════════════════════════════════
function handleAddReport(chatId, text) {
  // Format: /addreport Name|Price|Language|FileURL
  const parts = text.replace("/addreport ", "").split("|");
  if (parts.length < 3) {
    sendMessage(chatId, "Format: /addreport Name|Price|Language|FileURL\nExample: /addreport RELIANCE Analysis|99|Hindi|https://drive.google.com/...");
    return;
  }
  
  const newReport = {
    name: parts[0].trim(),
    price: parseInt(parts[1].trim()),
    language: parts[2].trim(),
    fileUrl: parts[3]?.trim() || "",
    sector: parts[4]?.trim() || "General",
  };
  
  saveReport(newReport);
  sendMessage(chatId, `✅ Report Added!\n\n📊 Name: ${newReport.name}\n💰 Price: ₹${newReport.price}\n🌐 Language: ${newReport.language}`);
}

// ═══════════════════════════════════════════
// ADMIN: STATS
// ═══════════════════════════════════════════
function sendAdminStats(chatId) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  const usersSheet = ss.getSheetByName(SHEETS.USERS);
  const paymentsSheet = ss.getSheetByName(SHEETS.PAYMENTS);
  const reportsSheet = ss.getSheetByName(SHEETS.REPORTS);
  const referralsSheet = ss.getSheetByName(SHEETS.REFERRALS);
  
  const totalUsers = usersSheet ? Math.max(0, usersSheet.getLastRow() - 1) : 0;
  const totalPayments = paymentsSheet ? Math.max(0, paymentsSheet.getLastRow() - 1) : 0;
  const totalReports = reportsSheet ? Math.max(0, reportsSheet.getLastRow() - 1) : 0;
  const totalReferrals = referralsSheet ? Math.max(0, referralsSheet.getLastRow() - 1) : 0;
  
  // Calculate revenue
  let totalRevenue = 0;
  if (paymentsSheet && paymentsSheet.getLastRow() > 1) {
    const payments = paymentsSheet.getRange(2, 1, paymentsSheet.getLastRow() - 1, 5).getValues();
    payments.forEach(p => {
      if (p[4] === "Success") totalRevenue += parseFloat(p[3]) || 0;
    });
  }
  
  const msg = `
📊 *Admin Statistics*
_${new Date().toLocaleString('en-IN')}_

👥 Total Users: ${totalUsers}
💳 Total Payments: ${totalPayments}
💰 Total Revenue: ₹${totalRevenue.toFixed(2)}
📊 Total Reports: ${totalReports}
🔗 Total Referrals: ${totalReferrals}

📈 Today's Signups: [Calculated from Sheet]
💸 Today's Revenue: [Calculated from Sheet]
  `;
  
  sendMessage(chatId, msg);
}

// ═══════════════════════════════════════════
// ADMIN: USERS LIST
// ═══════════════════════════════════════════
function sendUsersList(chatId) {
  const users = getAllUsers();
  let msg = `👥 *Recent Users (Last 10)*\n\n`;
  
  const recent = users.slice(-10).reverse();
  recent.forEach((u, i) => {
    msg += `${i+1}. ${u.name} | ID: ${u.userId}\n`;
  });
  
  sendMessage(chatId, msg);
}

// ═══════════════════════════════════════════
// WITHDRAWAL HANDLER
// ═══════════════════════════════════════════
function handleWithdrawal(chatId, userId) {
  const earnings = getUserEarnings(userId);
  const available = (earnings.total || 0) - (earnings.withdrawn || 0);
  
  if (available < CONFIG.MIN_WITHDRAWAL) {
    sendMessage(chatId, `⚠️ Insufficient Balance\n\nAvailable: ₹${available}\nMinimum: ₹${CONFIG.MIN_WITHDRAWAL}\n\nAur referrals लाएं कमाई बढ़ाएं!`, getBackKeyboard());
    return;
  }
  
  const msg = `
💸 *Withdrawal Request*

Available Balance: ₹${available}

Withdrawal के लिए Support से contact करें:
📱 @NiteshAutomations
💬 UPI ID या Bank details share करें

⏰ 24-48 hours में process होगा।
  `;
  
  sendMessage(chatId, msg, {
    inline_keyboard: [
      [{ text: "📞 Support Contact करें", url: "https://t.me/NiteshAutomations" }],
      [{ text: "🏠 Main Menu", callback_data: "menu" }]
    ]
  });
}

// ═══════════════════════════════════════════
// UNKNOWN MESSAGE HANDLER
// ═══════════════════════════════════════════
function handleUnknown(chatId, firstName) {
  sendMessage(chatId, `❓ Hi ${firstName}! मुझे समझ नहीं आया।\n\nMenu के लिए /menu type करें या नीचे से choose करें 👇`, getMainMenuKeyboard());
}

// ═══════════════════════════════════════════
// GOOGLE SHEETS — DATABASE FUNCTIONS
// ═══════════════════════════════════════════

function getSheet(name) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return ss.getSheetByName(name);
}

function registerUser(userId, name, username, chatId, refCode) {
  const sheet = getSheet(SHEETS.USERS);
  if (!sheet) return false;
  
  // Check if user exists
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == userId) return false; // Already exists
  }
  
  // Add new user
  const userRefCode = `NA-${userId.toString().slice(-6)}`;
  sheet.appendRow([
    userId,           // UserID (Telegram ID)
    name,             // Name
    "",               // Mobile (to be filled later)
    chatId,           // TelegramChatID
    username,         // Username
    userRefCode,      // ReferralCode
    refCode || "",    // ReferredBy
    new Date(),       // JoinDate
    "Active",         // Status
  ]);
  
  return true; // New user
}

function getUser(userId) {
  const sheet = getSheet(SHEETS.USERS);
  if (!sheet) return null;
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == userId) {
      return {
        userId: data[i][0],
        name: data[i][1],
        mobile: data[i][2],
        chatId: data[i][3],
        username: data[i][4],
        referralCode: data[i][5],
        referredBy: data[i][6],
        joinDate: data[i][7],
        status: data[i][8],
      };
    }
  }
  return null;
}

function getAllUsers() {
  const sheet = getSheet(SHEETS.USERS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  return data.map(row => ({
    userId: row[0], name: row[1], mobile: row[2],
    telegramId: row[3], username: row[4],
    referralCode: row[5], referredBy: row[6],
  }));
}

function processReferral(refCode, newUserId) {
  const sheet = getSheet(SHEETS.REFERRALS);
  if (!sheet) return;
  
  // Find referrer
  const usersSheet = getSheet(SHEETS.USERS);
  const usersData = usersSheet.getDataRange().getValues();
  let referrerId = null;
  
  for (let i = 1; i < usersData.length; i++) {
    if (usersData[i][5] === refCode) {
      referrerId = usersData[i][0];
      break;
    }
  }
  
  if (!referrerId) return;
  
  // Add referral record
  sheet.appendRow([
    referrerId,                    // ReferrerID
    newUserId,                     // ReferredUserID
    CONFIG.COMMISSION_RATE,        // Earnings
    new Date(),                    // Date
    "Pending",                     // Status
  ]);
}

function getReports() {
  const sheet = getSheet(SHEETS.REPORTS);
  if (!sheet || sheet.getLastRow() < 2) {
    // Return default reports if sheet is empty
    return [
      { id: "R001", name: "RELIANCE Industries Analysis", price: 99, language: "Hindi", sector: "Energy", originalPrice: 199, fileUrl: "" },
      { id: "R002", name: "TCS Comprehensive Report", price: 149, language: "English", sector: "IT", originalPrice: 299, fileUrl: "" },
      { id: "R003", name: "HDFC Bank Deep Dive", price: 99, language: "Hindi", sector: "Banking", originalPrice: 199, fileUrl: "" },
    ];
  }
  
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  return data.map(row => ({
    id: row[0], name: row[1], language: row[2],
    price: row[3], fileUrl: row[4], sector: row[5],
    originalPrice: row[6] || row[3] * 2,
  })).filter(r => r.name);
}

function getReportById(reportId) {
  return getReports().find(r => r.id === reportId || r.id == reportId);
}

function saveReport(report) {
  const sheet = getSheet(SHEETS.REPORTS);
  if (!sheet) return;
  
  const lastRow = sheet.getLastRow();
  const newId = "R" + String(lastRow).padStart(3, "0");
  
  sheet.appendRow([newId, report.name, report.language, report.price, report.fileUrl, report.sector, "", new Date()]);
}

function savePendingPayment(userId, reportId, amount) {
  const sheet = getSheet(SHEETS.PAYMENTS);
  if (!sheet) return;
  
  const paymentId = "PAY-" + Date.now().toString().slice(-8);
  sheet.appendRow([paymentId, userId, reportId, amount, "Pending", new Date()]);
}

function getUserEarnings(userId) {
  const sheet = getSheet(SHEETS.REFERRALS);
  const referrals = getUserReferrals(userId);
  
  return {
    total: referrals.count * CONFIG.COMMISSION_RATE,
    pending: 0,
    withdrawn: 0,
    referralCount: referrals.count,
    referralEarnings: referrals.count * CONFIG.COMMISSION_RATE,
  };
}

function getUserReferrals(userId) {
  const sheet = getSheet(SHEETS.REFERRALS);
  if (!sheet || sheet.getLastRow() < 2) return { count: 0, referrals: [] };
  
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const myReferrals = data.filter(row => row[0] == userId);
  
  return { count: myReferrals.length, referrals: myReferrals };
}

function trackDematClick(userId) {
  // Could track in a separate sheet or column
  Logger.log(`Demat click by user: ${userId}`);
}

// ═══════════════════════════════════════════
// TELEGRAM API FUNCTIONS
// ═══════════════════════════════════════════

function sendMessage(chatId, text, keyboard) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  };
  
  if (keyboard) {
    payload.reply_markup = JSON.stringify(keyboard);
  }
  
  try {
    const response = UrlFetchApp.fetch(`${API_URL}/sendMessage`, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    return JSON.parse(response.getContentText());
  } catch (e) {
    Logger.log("sendMessage error: " + e.toString());
  }
}

function answerCallback(callbackId, text) {
  UrlFetchApp.fetch(`${API_URL}/answerCallbackQuery`, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ callback_query_id: callbackId, text: text || "" }),
    muteHttpExceptions: true,
  });
}

function sendDocument(chatId, fileUrl, caption) {
  UrlFetchApp.fetch(`${API_URL}/sendDocument`, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: chatId,
      document: fileUrl,
      caption: caption || "",
      parse_mode: "Markdown",
    }),
    muteHttpExceptions: true,
  });
}

function getBackKeyboard() {
  return { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "menu" }]] };
}

// ═══════════════════════════════════════════
// WEBHOOK SETUP (Run this function ONCE)
// ═══════════════════════════════════════════
function setWebhook() {
  const webAppUrl = ScriptApp.getService().getUrl();
  const response = UrlFetchApp.fetch(`${API_URL}/setWebhook?url=${webAppUrl}`);
  Logger.log("Webhook set: " + response.getContentText());
}

function deleteWebhook() {
  const response = UrlFetchApp.fetch(`${API_URL}/deleteWebhook`);
  Logger.log("Webhook deleted: " + response.getContentText());
}

function getBotInfo() {
  const response = UrlFetchApp.fetch(`${API_URL}/getMe`);
  Logger.log("Bot info: " + response.getContentText());
}

// ═══════════════════════════════════════════
// INITIALIZE SHEETS (Run this ONCE to create structure)
// ═══════════════════════════════════════════
function initializeSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  // Users Sheet
  let sheet = ss.getSheetByName(SHEETS.USERS) || ss.insertSheet(SHEETS.USERS);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["UserID", "Name", "Mobile", "TelegramChatID", "Username", "ReferralCode", "ReferredBy", "JoinDate", "Status"]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#00D4AA").setFontColor("#000000");
  }
  
  // Reports Sheet
  sheet = ss.getSheetByName(SHEETS.REPORTS) || ss.insertSheet(SHEETS.REPORTS);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ReportID", "Name", "Language", "Price", "FileURL", "Sector", "OriginalPrice", "CreatedAt"]);
    sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#00D4AA").setFontColor("#000000");
    // Add sample reports
    sheet.appendRow(["R001", "RELIANCE Industries Analysis", "Hindi", 99, "", "Energy", 199, new Date()]);
    sheet.appendRow(["R002", "TCS Comprehensive Report", "English", 149, "", "IT", 299, new Date()]);
    sheet.appendRow(["R003", "HDFC Bank Deep Dive", "Hindi", 99, "", "Banking", 199, new Date()]);
  }
  
  // Payments Sheet
  sheet = ss.getSheetByName(SHEETS.PAYMENTS) || ss.insertSheet(SHEETS.PAYMENTS);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["PaymentID", "UserID", "ReportID", "Amount", "Status", "Date", "TransactionRef"]);
    sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#00D4AA").setFontColor("#000000");
  }
  
  // Referrals Sheet
  sheet = ss.getSheetByName(SHEETS.REFERRALS) || ss.insertSheet(SHEETS.REFERRALS);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ReferrerID", "ReferredUserID", "Earnings", "Date", "Status"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#00D4AA").setFontColor("#000000");
  }
  
  // Contact Sheet
  sheet = ss.getSheetByName(SHEETS.CONTACT) || ss.insertSheet(SHEETS.CONTACT);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Name", "Contact", "Subject", "Message", "Date"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#00D4AA").setFontColor("#000000");
  }
  
  Logger.log("✅ All sheets initialized successfully!");
  
  // Format all sheets
  [SHEETS.USERS, SHEETS.REPORTS, SHEETS.PAYMENTS, SHEETS.REFERRALS, SHEETS.CONTACT].forEach(name => {
    const s = ss.getSheetByName(name);
    if(s) {
      s.setFrozenRows(1);
      s.getRange(1, 1, 1, s.getLastColumn()).setFontWeight("bold");
    }
  });
}

// ═══════════════════════════════════════════
// CONTACT FORM HANDLER (from Website)
// ═══════════════════════════════════════════
function doGet(e) {
  // Handle contact form submissions from website
  if (e && e.parameter) {
    const { name, contact, subject, message } = e.parameter;
    if (name && contact && message) {
      const sheet = getSheet(SHEETS.CONTACT);
      if (sheet) {
        sheet.appendRow([name, contact, subject, message, new Date()]);
      }
      
      // Notify admin
      sendMessage(CONFIG.ADMIN_CHAT_ID, `📩 *New Contact Message*\n\n👤 Name: ${name}\n📱 Contact: ${contact}\n📋 Subject: ${subject}\n💬 Message: ${message}`);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: "ok", bot: "Nitesh Automations Bot" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════
// SCHEDULED TASKS (Set as time-based triggers)
// ═══════════════════════════════════════════

// Run daily to send market updates
function sendDailyUpdate() {
  const users = getAllUsers();
  const msg = `
📊 *Daily Market Update — Nitesh Automations*

🗓 ${new Date().toLocaleDateString('en-IN', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}

📈 NIFTY 50: ▲ 23,847 (+0.65%)
📊 SENSEX: ▲ 78,342 (+0.72%)
💹 BANK NIFTY: ▲ 51,234 (+0.45%)

🔥 *Top Gainers Today:*
• ICICI BANK +2.1%
• HDFC BANK +1.5%
• RELIANCE +1.2%

📉 *Top Losers:*
• MARUTI -1.1%
• INFOSYS -0.4%

📊 *Expert View:* Market bullish दिख रहा है। Tech और Banking sectors strong performance दे रहे हैं।

📚 Research Reports: /reports

⚠️ Educational purpose only.
  `;
  
  users.forEach((user, i) => {
    setTimeout(() => {
      try { sendMessage(user.telegramId || user.chatId, msg); } catch(e) {}
    }, i * 100);
  });
}

// Auto-send PDF after payment approval (called by admin)
function sendPDFToUser(userId, reportId) {
  const user = getUser(userId);
  const report = getReportById(reportId);
  
  if (!user || !report) return;
  
  const msg = `
✅ *Payment Approved! Thank You!*

📊 *${report.name}*

📥 Download करने के लिए नीचे click करें:
${report.fileUrl || "Link processing..."}

⚠️ यह link personal use के लिए है। Share न करें।

🙏 Nitesh Automations में invest करने के लिए धन्यवाद!
  `;
  
  sendMessage(user.chatId, msg, {
    inline_keyboard: [
      [{ text: "📥 PDF Download करें", url: report.fileUrl || CONFIG.WEBSITE_URL }],
      [{ text: "📊 More Reports", callback_data: "reports" }]
    ]
  });
}
