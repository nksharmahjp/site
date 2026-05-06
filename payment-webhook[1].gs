// ╔══════════════════════════════════════════════════════════════════════╗
// ║     NITESH AUTOMATIONS — PAYMENT WEBHOOK HANDLER                   ║
// ║     Razorpay Webhook + UPI Auto-Verify + PDF Auto-Delivery         ║
// ║     Paste into same Apps Script project OR separate deployment      ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ════════════════════════════════════════════
// PAYMENT CONFIG
// ════════════════════════════════════════════
const PAY_CONFIG = {
  SPREADSHEET_ID:       "YOUR_SPREADSHEET_ID_HERE",
  RAZORPAY_KEY_ID:      "rzp_live_XXXXXXXXXX",
  RAZORPAY_KEY_SECRET:  "YOUR_RAZORPAY_SECRET",
  TELEGRAM_BOT_TOKEN:   "YOUR_BOT_TOKEN_HERE",
  ADMIN_CHAT_ID:        "YOUR_ADMIN_CHAT_ID",
  ADMIN_EMAIL:          "nitesh@niteshautomations.com",
  WEBHOOK_SECRET:       "YOUR_RAZORPAY_WEBHOOK_SECRET",
  COMMISSION_AMOUNT:    50,   // ₹ per referral
};

// ════════════════════════════════════════════
// RAZORPAY WEBHOOK ENTRY POINT
// POST from Razorpay → this function
// ════════════════════════════════════════════
function doPostWebhook(e) {
  try {
    const raw     = e.postData.contents;
    const payload = JSON.parse(raw);
    const event   = payload.event;

    Logger.log("Razorpay webhook received: " + event);

    switch (event) {
      case "payment.captured":
        handlePaymentCaptured(payload.payload.payment.entity);
        break;
      case "payment.failed":
        handlePaymentFailed(payload.payload.payment.entity);
        break;
      case "order.paid":
        handleOrderPaid(payload.payload.order.entity, payload.payload.payment.entity);
        break;
      default:
        Logger.log("Unhandled event: " + event);
    }

    return ContentService.createTextOutput(JSON.stringify({ received: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("Webhook error: " + err.toString());
    return ContentService.createTextOutput("ERROR").setMimeType(ContentService.MimeType.TEXT);
  }
}

// ════════════════════════════════════════════
// PAYMENT CAPTURED → UNLOCK REPORT
// ════════════════════════════════════════════
function handlePaymentCaptured(payment) {
  const paymentId = payment.id;                // pay_XXXXXXXXXX
  const orderId   = payment.order_id;          // order_XXXXXXXXXX
  const amount    = payment.amount / 100;       // paise → rupees
  const email     = payment.email || "";
  const contact   = payment.contact || "";
  const notes     = payment.notes || {};

  const userId   = notes.userId   || notes.user_id   || "";
  const reportId = notes.reportId || notes.report_id || "";

  Logger.log(`Payment captured: ${paymentId} | ₹${amount} | User: ${userId} | Report: ${reportId}`);

  if (!userId || !reportId) {
    notifyAdmin(`⚠️ Payment captured but metadata missing!\nPaymentID: ${paymentId}\nAmount: ₹${amount}\nEmail: ${email}`);
    return;
  }

  // 1. Save to Payments sheet
  savePaymentRecord(paymentId, orderId, userId, reportId, amount, "Success", email, contact);

  // 2. Process referral commission if applicable
  processReferralCommission(userId, reportId);

  // 3. Get report download URL
  const report  = getReportDetails(reportId);
  const fileUrl = report ? report.fileUrl : "";

  // 4. Send PDF to user via Telegram
  if (userId) sendPDFViaTelegram(userId, report, fileUrl, paymentId);

  // 5. Send confirmation email
  if (email) sendPaymentEmailConfirmation(email, userId, report, amount, paymentId, fileUrl);

  // 6. Notify admin
  notifyAdmin(
    `✅ *Payment Received!*\n\n` +
    `💰 Amount: ₹${amount}\n` +
    `📊 Report: ${report ? report.name : reportId}\n` +
    `👤 UserID: ${userId}\n` +
    `💳 PaymentID: ${paymentId}\n` +
    `📧 Email: ${email}\n` +
    `📱 Mobile: ${contact}\n` +
    `⏰ Time: ${new Date().toLocaleString("en-IN")}`
  );

  Logger.log("Payment fully processed: " + paymentId);
}

// ════════════════════════════════════════════
// PAYMENT FAILED → NOTIFY USER + ADMIN
// ════════════════════════════════════════════
function handlePaymentFailed(payment) {
  const paymentId  = payment.id;
  const amount     = payment.amount / 100;
  const notes      = payment.notes || {};
  const userId     = notes.userId || "";
  const reportId   = notes.reportId || "";
  const errorCode  = payment.error_code || "UNKNOWN";
  const errorDesc  = payment.error_description || "Payment failed";

  // Save failed record
  savePaymentRecord(paymentId, payment.order_id, userId, reportId, amount, "Failed", payment.email, payment.contact);

  // Notify user via Telegram
  if (userId) {
    sendTelegramMessage(
      getUserChatId(userId),
      `❌ *Payment Failed*\n\n` +
      `💰 Amount: ₹${amount}\n` +
      `📊 Report: ${reportId}\n` +
      `❗ Error: ${errorDesc}\n\n` +
      `कृपया दोबारा try करें या support से contact करें।`,
      {
        inline_keyboard: [
          [{ text: "🔄 Retry Payment", callback_data: `buy_${reportId}` }],
          [{ text: "📞 Support", callback_data: "support" }]
        ]
      }
    );
  }

  notifyAdmin(`❌ Payment Failed\nUser: ${userId}\nReport: ${reportId}\nAmount: ₹${amount}\nError: ${errorCode} — ${errorDesc}`);
}

// ════════════════════════════════════════════
// ORDER PAID
// ════════════════════════════════════════════
function handleOrderPaid(order, payment) {
  Logger.log("Order paid: " + order.id + " | Payment: " + payment.id);
  // Additional order-level handling if needed
  handlePaymentCaptured(payment);
}

// ════════════════════════════════════════════
// CREATE RAZORPAY ORDER (called from frontend)
// ════════════════════════════════════════════
function createRazorpayOrder(userId, reportId, amount) {
  const url = "https://api.razorpay.com/v1/orders";

  const orderData = {
    amount:   amount * 100,    // paise
    currency: "INR",
    receipt:  "rcpt_" + userId + "_" + reportId + "_" + Date.now(),
    notes: {
      userId:   userId,
      reportId: reportId,
      platform: "NiteshAutomations",
    },
    payment_capture: 1,
  };

  const credentials = Utilities.base64Encode(
    PAY_CONFIG.RAZORPAY_KEY_ID + ":" + PAY_CONFIG.RAZORPAY_KEY_SECRET
  );

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Authorization": "Basic " + credentials,
        "Content-Type":  "application/json",
      },
      payload: JSON.stringify(orderData),
      muteHttpExceptions: true,
    });

    const result = JSON.parse(response.getContentText());
    Logger.log("Order created: " + result.id);
    return result;

  } catch (err) {
    Logger.log("Order creation error: " + err.toString());
    return null;
  }
}

// ════════════════════════════════════════════
// FETCH PAYMENT DETAILS FROM RAZORPAY
// ════════════════════════════════════════════
function fetchRazorpayPayment(paymentId) {
  const credentials = Utilities.base64Encode(
    PAY_CONFIG.RAZORPAY_KEY_ID + ":" + PAY_CONFIG.RAZORPAY_KEY_SECRET
  );

  try {
    const response = UrlFetchApp.fetch(
      `https://api.razorpay.com/v1/payments/${paymentId}`,
      {
        method: "get",
        headers: { "Authorization": "Basic " + credentials },
        muteHttpExceptions: true,
      }
    );
    return JSON.parse(response.getContentText());
  } catch (err) {
    Logger.log("Fetch payment error: " + err.toString());
    return null;
  }
}

// ════════════════════════════════════════════
// UPI MANUAL PAYMENT VERIFIER
// Admin calls this to manually verify UPI payments
// ════════════════════════════════════════════
function verifyManualUPIPayment(userId, reportId, utrNumber, amount) {
  Logger.log(`Manual UPI verify: UTR=${utrNumber} | User=${userId} | Report=${reportId} | ₹${amount}`);

  // Check if UTR already used
  const sheet = getPaymentsSheet();
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][6] === utrNumber) {
      notifyAdmin(`⚠️ Duplicate UTR: ${utrNumber} already used!`);
      return { success: false, message: "UTR already used" };
    }
  }

  // Record payment
  const paymentId = "UPI-" + utrNumber;
  savePaymentRecord(paymentId, "", userId, reportId, amount, "Success", "", "");

  // Process delivery
  const report  = getReportDetails(reportId);
  const fileUrl = report ? report.fileUrl : "";

  sendPDFViaTelegram(userId, report, fileUrl, paymentId);
  processReferralCommission(userId, reportId);
  notifyAdmin(`✅ UPI Payment Verified!\nUTR: ${utrNumber}\nUser: ${userId}\nReport: ${report?.name}\nAmount: ₹${amount}`);

  return { success: true, message: "Payment verified and PDF sent!" };
}

// ════════════════════════════════════════════
// REFERRAL COMMISSION PROCESSOR
// ════════════════════════════════════════════
function processReferralCommission(userId, reportId) {
  try {
    const ss   = SpreadsheetApp.openById(PAY_CONFIG.SPREADSHEET_ID);
    const uSheet = ss.getSheetByName("Users");
    const rSheet = ss.getSheetByName("Referrals");

    if (!uSheet || !rSheet) return;

    // Find who referred this user
    const users = uSheet.getDataRange().getValues();
    let referrerId   = null;
    let referrerCode = null;
    let referrerChatId = null;

    for (let i = 1; i < users.length; i++) {
      if (String(users[i][0]) === String(userId)) {
        referrerCode   = users[i][6]; // ReferredBy column
        break;
      }
    }

    if (!referrerCode) return;

    // Find referrer's user ID and chat ID
    for (let i = 1; i < users.length; i++) {
      if (users[i][5] === referrerCode) {
        referrerId     = users[i][0];
        referrerChatId = users[i][3]; // TelegramChatID
        break;
      }
    }

    if (!referrerId) return;

    // Update referral status to Approved + add earnings
    const refData = rSheet.getDataRange().getValues();
    for (let i = 1; i < refData.length; i++) {
      if (String(refData[i][0]) === String(referrerId) &&
          String(refData[i][1]) === String(userId) &&
          refData[i][4] === "Pending") {
        rSheet.getRange(i + 1, 4).setValue("Approved");
        rSheet.getRange(i + 1, 5).setValue(new Date());
        break;
      }
    }

    // Notify referrer via Telegram
    if (referrerChatId) {
      sendTelegramMessage(
        referrerChatId,
        `🎉 *Referral Commission Earned!*\n\n` +
        `💰 ₹${PAY_CONFIG.COMMISSION_AMOUNT} आपके account में add हुआ!\n` +
        `📊 एक user ने आपके referral से report खरीदी\n\n` +
        `💸 /earnings command से balance देखें`
      );
    }

    Logger.log(`Referral commission processed: Referrer=${referrerId} | ₹${PAY_CONFIG.COMMISSION_AMOUNT}`);

  } catch (err) {
    Logger.log("Referral commission error: " + err.toString());
  }
}

// ════════════════════════════════════════════
// PDF DELIVERY VIA TELEGRAM
// ════════════════════════════════════════════
function sendPDFViaTelegram(userId, report, fileUrl, paymentId) {
  const chatId = getUserChatId(userId);
  if (!chatId) {
    Logger.log("No Telegram chat ID for user: " + userId);
    return;
  }

  const reportName = report ? report.name : "Your Report";
  const msg =
    `✅ *Payment Confirmed! Thank You!*\n\n` +
    `📊 *${reportName}*\n` +
    `💳 Payment ID: \`${paymentId}\`\n` +
    `⏰ ${new Date().toLocaleString("en-IN")}\n\n` +
    `📥 नीचे button से PDF download करें\n\n` +
    `⚠️ _यह link personal use के लिए है। Share न करें।_\n\n` +
    `🙏 Nitesh Automations में trust करने के लिए धन्यवाद!`;

  const keyboard = fileUrl
    ? {
        inline_keyboard: [
          [{ text: "📥 PDF Download करें", url: fileUrl }],
          [{ text: "📊 More Reports", callback_data: "reports" },
           { text: "👥 Refer & Earn", callback_data: "referral" }],
        ],
      }
    : {
        inline_keyboard: [
          [{ text: "📞 Support से PDF लें", url: "https://t.me/NiteshAutomations" }],
        ],
      };

  sendTelegramMessage(chatId, msg, keyboard);
}

// ════════════════════════════════════════════
// PAYMENT CONFIRMATION EMAIL
// ════════════════════════════════════════════
function sendPaymentEmailConfirmation(email, userId, report, amount, paymentId, fileUrl) {
  if (!email) return;

  const reportName = report ? report.name : "Stock Research Report";

  MailApp.sendEmail({
    to: email,
    subject: `✅ Payment Confirmed ₹${amount} — ${reportName} | Nitesh Automations`,
    htmlBody: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;font-family:'Segoe UI',Arial,sans-serif;background:#090c10">
<div style="max-width:600px;margin:0 auto">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#00D4AA,#00A884);padding:30px;border-radius:16px 16px 0 0;text-align:center">
    <h1 style="color:#000;margin:0;font-size:26px">✅ Payment Confirmed!</h1>
    <p style="color:#001a14;margin:8px 0 0;font-size:14px">Nitesh Automations — Stock Market Research</p>
  </div>

  <!-- Body -->
  <div style="background:#0d1117;padding:35px;border:1px solid rgba(0,212,170,0.15);border-top:none">

    <p style="color:#e8edf2;font-size:16px">
      आपकी payment successfully received हो गई है! 🎉
    </p>

    <!-- Receipt Box -->
    <div style="background:#131a22;border:1px solid rgba(0,212,170,0.2);border-radius:12px;padding:25px;margin:25px 0">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:8px 0;color:#8892a4;font-size:13px;width:140px">📊 Report</td>
          <td style="padding:8px 0;color:#e8edf2;font-weight:600">${reportName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#8892a4;font-size:13px">💰 Amount Paid</td>
          <td style="padding:8px 0;color:#FFD700;font-weight:700;font-size:20px">₹${amount}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#8892a4;font-size:13px">💳 Payment ID</td>
          <td style="padding:8px 0;color:#00D4AA;font-family:monospace;font-size:13px">${paymentId}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#8892a4;font-size:13px">⏰ Date & Time</td>
          <td style="padding:8px 0;color:#e8edf2">${new Date().toLocaleString("en-IN", { dateStyle:"full", timeStyle:"short" })}</td>
        </tr>
      </table>
    </div>

    <!-- Download Button -->
    ${fileUrl ? `
    <div style="text-align:center;margin:30px 0">
      <a href="${fileUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#00D4AA,#00A884);color:#000;
                padding:16px 40px;border-radius:12px;text-decoration:none;
                font-weight:700;font-size:18px;letter-spacing:0.5px">
        📥 PDF Download करें
      </a>
      <p style="color:#8892a4;font-size:12px;margin:10px 0 0">
        यह link सिर्फ आपके लिए है — please share न करें
      </p>
    </div>
    ` : `
    <div style="background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);border-radius:10px;padding:15px;margin:20px 0;text-align:center">
      <p style="color:#FFD700;margin:0">📩 आपका PDF link 30 minutes में email/Telegram पर भेजा जाएगा।</p>
    </div>
    `}

    <!-- Features -->
    <div style="background:#131a22;border-radius:10px;padding:20px;margin:20px 0">
      <p style="color:#00D4AA;font-weight:600;margin:0 0 12px">🚀 और explore करें:</p>
      <p style="color:#8892a4;margin:6px 0">📊 <a href="https://niteshautomations.com/#reports" style="color:#00D4AA">More Research Reports</a> देखें</p>
      <p style="color:#8892a4;margin:6px 0">🔗 <a href="https://t.me/NiteshAutomationsBot" style="color:#00D4AA">Telegram Bot</a> join करें</p>
      <p style="color:#8892a4;margin:6px 0">👥 <a href="https://niteshautomations.com/?ref=${userId}" style="color:#00D4AA">Referral Link</a> share करके ₹50/referral कमाएं</p>
    </div>

    <p style="color:#8892a4;font-size:14px">
      कोई भी query हो तो:<br>
      📱 WhatsApp: +91 XXXXX XXXXX<br>
      ✈ Telegram: @NiteshAutomations<br>
      📧 Email: nitesh@niteshautomations.com
    </p>

    <p style="color:#e8edf2">
      Regards,<br>
      <strong style="color:#00D4AA">Nitesh Kumar</strong><br>
      Founder, Nitesh Automations
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#090c10;padding:20px;border:1px solid rgba(0,212,170,0.1);border-top:none;border-radius:0 0 16px 16px;text-align:center">
    <p style="color:#4a5568;font-size:12px;margin:0 0 6px">
      © 2024 Nitesh Automations | Made with ❤️ in India 🇮🇳
    </p>
    <p style="color:#4a5568;font-size:11px;margin:0">
      ⚠️ This content is for educational purposes only. We are not SEBI-registered investment advisors.
    </p>
  </div>

</div>
</body>
</html>
    `,
  });
}

// ════════════════════════════════════════════
// DAILY REVENUE REPORT TO ADMIN
// Set as time-based trigger: Daily at 9 PM
// ════════════════════════════════════════════
function sendDailyRevenueReport() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sheet  = getPaymentsSheet();
  if (!sheet || sheet.getLastRow() < 2) return;

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();

  let todayRevenue = 0, todayCount = 0;
  let totalRevenue = 0, totalCount = 0;

  data.forEach(row => {
    if (row[4] === "Success") {
      const amt = parseFloat(row[3]) || 0;
      totalRevenue += amt;
      totalCount++;
      const rowDate = new Date(row[5]);
      rowDate.setHours(0, 0, 0, 0);
      if (rowDate.getTime() === today.getTime()) {
        todayRevenue += amt;
        todayCount++;
      }
    }
  });

  const usersSheet = SpreadsheetApp.openById(PAY_CONFIG.SPREADSHEET_ID).getSheetByName("Users");
  const totalUsers = usersSheet ? Math.max(0, usersSheet.getLastRow() - 1) : 0;

  const msg =
    `📊 *Daily Revenue Report*\n` +
    `📅 ${today.toLocaleDateString("en-IN", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}\n\n` +
    `*Today:*\n` +
    `💰 Revenue: ₹${todayRevenue.toFixed(2)}\n` +
    `🛒 Transactions: ${todayCount}\n\n` +
    `*All Time:*\n` +
    `💰 Total Revenue: ₹${totalRevenue.toFixed(2)}\n` +
    `🛒 Total Transactions: ${totalCount}\n` +
    `👥 Total Users: ${totalUsers}\n\n` +
    `📈 Keep growing! 🚀`;

  notifyAdmin(msg);
}

// ════════════════════════════════════════════
// PENDING PAYMENTS CHECKER
// Set as time-based trigger: Every 30 minutes
// ════════════════════════════════════════════
function checkPendingPayments() {
  const sheet = getPaymentsSheet();
  if (!sheet || sheet.getLastRow() < 2) return;

  const data     = sheet.getDataRange().getValues();
  const cutoff   = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
  const pending  = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][4] === "Pending") {
      const payDate = new Date(data[i][5]);
      if (payDate < cutoff) {
        pending.push({
          paymentId: data[i][0],
          userId:    data[i][1],
          reportId:  data[i][2],
          amount:    data[i][3],
          date:      data[i][5],
        });
      }
    }
  }

  if (pending.length > 0) {
    const list = pending.map(p =>
      `• User: ${p.userId} | Report: ${p.reportId} | ₹${p.amount} | ${new Date(p.date).toLocaleString("en-IN")}`
    ).join("\n");

    notifyAdmin(
      `⚠️ *${pending.length} Pending Payment(s) > 2 hours old*\n\n${list}\n\n` +
      `Please verify manually or contact the user.`
    );
  }
}

// ════════════════════════════════════════════
// GOOGLE SHEETS HELPERS
// ════════════════════════════════════════════
function getPaymentsSheet() {
  return SpreadsheetApp.openById(PAY_CONFIG.SPREADSHEET_ID).getSheetByName("Payments");
}

function savePaymentRecord(paymentId, orderId, userId, reportId, amount, status, email, contact) {
  const sheet = getPaymentsSheet();
  if (!sheet) return;
  sheet.appendRow([
    paymentId, userId, reportId, amount,
    status, new Date(), orderId || paymentId,
    "Razorpay", email, contact,
  ]);
}

function getReportDetails(reportId) {
  const ss    = SpreadsheetApp.openById(PAY_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Reports");
  if (!sheet || sheet.getLastRow() < 2) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(reportId)) {
      return { id: data[i][0], name: data[i][1], language: data[i][2],
               price: data[i][3], fileUrl: data[i][4], sector: data[i][5] };
    }
  }
  return null;
}

function getUserChatId(userId) {
  const ss    = SpreadsheetApp.openById(PAY_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Users");
  if (!sheet || sheet.getLastRow() < 2) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      return data[i][3]; // TelegramChatID column
    }
  }
  return null;
}

// ════════════════════════════════════════════
// TELEGRAM API HELPERS
// ════════════════════════════════════════════
function sendTelegramMessage(chatId, text, keyboard) {
  if (!chatId) return;

  const payload = {
    chat_id:                  chatId,
    text:                     text,
    parse_mode:               "Markdown",
    disable_web_page_preview: true,
  };
  if (keyboard) payload.reply_markup = JSON.stringify(keyboard);

  try {
    UrlFetchApp.fetch(
      `https://api.telegram.org/bot${PAY_CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method:           "post",
        contentType:      "application/json",
        payload:          JSON.stringify(payload),
        muteHttpExceptions: true,
      }
    );
  } catch (err) {
    Logger.log("Telegram send error: " + err.toString());
  }
}

function notifyAdmin(msg) {
  sendTelegramMessage(PAY_CONFIG.ADMIN_CHAT_ID, msg);
}

// ════════════════════════════════════════════
// MANUAL TRIGGER — test payment flow
// ════════════════════════════════════════════
function testPaymentFlow() {
  handlePaymentCaptured({
    id:          "pay_TEST123456",
    order_id:    "order_TEST123456",
    amount:      9900,
    email:       "test@example.com",
    contact:     "+911234567890",
    notes:       { userId: "NA00000001", reportId: "R001" },
  });
  Logger.log("Test payment flow complete — check Sheets and Telegram.");
}

// ════════════════════════════════════════════
// SETUP TIME-BASED TRIGGERS (Run ONCE)
// ════════════════════════════════════════════
function setupTriggers() {
  // Remove existing triggers first
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Daily revenue report at 9 PM IST
  ScriptApp.newTrigger("sendDailyRevenueReport")
    .timeBased().everyDays(1).atHour(21).create();

  // Pending payment check every 2 hours
  ScriptApp.newTrigger("checkPendingPayments")
    .timeBased().everyHours(2).create();

  Logger.log("✅ Triggers set up successfully!");
}
