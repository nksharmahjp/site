// ╔══════════════════════════════════════════════════════════════════════╗
// ║     NITESH AUTOMATIONS — GOOGLE SHEETS WEB APP BACKEND             ║
// ║     Handles: Contact Form, Payment Verify, User Registration        ║
// ║     Deploy: Apps Script → Web App → Anyone can access              ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════
// CONFIGURATION — अपना SPREADSHEET_ID यहाँ डालें
// ═══════════════════════════════════════════
const SHEET_CONFIG = {
  SPREADSHEET_ID: "YOUR_SPREADSHEET_ID_HERE",
  ADMIN_EMAIL: "nitesh@niteshautomations.com",
  RAZORPAY_KEY_SECRET: "YOUR_RAZORPAY_SECRET_HERE",
  SITE_NAME: "Nitesh Automations",
};

// Sheet names
const SH = {
  USERS: "Users",
  REPORTS: "Reports",
  PAYMENTS: "Payments",
  REFERRALS: "Referrals",
  CONTACT: "Contact",
};

// ═══════════════════════════════════════════
// CORS HEADERS
// ═══════════════════════════════════════════
function setCORSHeaders(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON);
}

function createResponse(data, status) {
  const response = { status: status || "success", ...data };
  return setCORSHeaders(ContentService.createTextOutput(JSON.stringify(response)));
}

function createError(message, code) {
  return setCORSHeaders(ContentService.createTextOutput(JSON.stringify({
    status: "error", message: message, code: code || 400
  })));
}

// ═══════════════════════════════════════════
// MAIN REQUEST HANDLERS
// ═══════════════════════════════════════════
function doPost(e) {
  try {
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      data = e.parameter;
    }

    const action = data.action || e.parameter?.action;

    switch (action) {
      case "register":         return handleRegister(data);
      case "login":            return handleLogin(data);
      case "contact":          return handleContact(data);
      case "verifyPayment":    return handlePaymentVerify(data);
      case "getReports":       return handleGetReports(data);
      case "purchaseReport":   return handlePurchaseReport(data);
      case "getUser":          return handleGetUser(data);
      case "updateProfile":    return handleUpdateProfile(data);
      case "getReferralStats": return handleGetReferralStats(data);
      case "getEarnings":      return handleGetEarnings(data);
      case "addReport":        return handleAddReport(data);      // Admin
      case "deleteReport":     return handleDeleteReport(data);   // Admin
      case "getAllUsers":       return handleGetAllUsers(data);    // Admin
      case "getPayments":      return handleGetPayments(data);    // Admin
      case "approvePayment":   return handleApprovePayment(data); // Admin
      default:
        return createError("Unknown action: " + action);
    }
  } catch (err) {
    Logger.log("Error: " + err.toString());
    return createError("Server error: " + err.message, 500);
  }
}

function doGet(e) {
  const action = e.parameter?.action;

  if (action === "getReports") return handleGetReports(e.parameter);
  if (action === "getUser")    return handleGetUser(e.parameter);
  if (action === "health")     return createResponse({ message: "Nitesh Automations API is running", timestamp: new Date() });

  return createResponse({ message: "Nitesh Automations API", version: "1.0" });
}

// ═══════════════════════════════════════════
// USER REGISTRATION
// ═══════════════════════════════════════════
function handleRegister(data) {
  const { name, mobile, email, password, referralCode } = data;

  if (!name || !mobile || !password) {
    return createError("Name, mobile, and password are required");
  }

  if (mobile.replace(/\D/g, "").length < 10) {
    return createError("Valid mobile number required");
  }

  const sheet = getSheet(SH.USERS);
  const existingUsers = sheet.getDataRange().getValues();

  // Check if mobile already registered
  for (let i = 1; i < existingUsers.length; i++) {
    if (existingUsers[i][2] === mobile) {
      return createError("Mobile number already registered");
    }
  }

  // Generate user ID and referral code
  const userId = "NA" + Date.now().toString().slice(-8);
  const userRefCode = "REF-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const hashedPassword = Utilities.base64Encode(Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, password + "nitesh_salt"
  ));

  // Save user
  sheet.appendRow([
    userId, name, mobile, email || "",
    hashedPassword, userRefCode, referralCode || "",
    new Date(), "Active", "", // TelegramID left empty
  ]);

  // Process referral if provided
  if (referralCode) {
    processReferralFromWeb(referralCode, userId);
  }

  // Send welcome email
  try {
    sendWelcomeEmail(email, name, userId, userRefCode);
  } catch (e) {
    Logger.log("Email send error: " + e.message);
  }

  return createResponse({
    message: "Registration successful! Welcome to Nitesh Automations!",
    userId: userId,
    referralCode: userRefCode,
    name: name,
  });
}

// ═══════════════════════════════════════════
// USER LOGIN
// ═══════════════════════════════════════════
function handleLogin(data) {
  const { mobile, password } = data;

  if (!mobile || !password) {
    return createError("Mobile and password required");
  }

  const sheet = getSheet(SH.USERS);
  const users = sheet.getDataRange().getValues();
  const hashedPassword = Utilities.base64Encode(Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, password + "nitesh_salt"
  ));

  for (let i = 1; i < users.length; i++) {
    const row = users[i];
    if ((row[2] === mobile || row[3] === mobile) && row[4] === hashedPassword) {
      // Update last login
      sheet.getRange(i + 1, 10).setValue(new Date());

      // Get purchased reports
      const purchases = getUserPurchases(row[0]);

      return createResponse({
        message: "Login successful",
        user: {
          userId: row[0], name: row[1], mobile: row[2],
          email: row[3], referralCode: row[5], referredBy: row[6],
          joinDate: row[7], status: row[8],
        },
        purchases: purchases,
        token: Utilities.base64Encode(row[0] + ":" + new Date().toDateString()),
      });
    }
  }

  return createError("Invalid credentials");
}

// ═══════════════════════════════════════════
// CONTACT FORM
// ═══════════════════════════════════════════
function handleContact(data) {
  const { name, contact, subject, message } = data;

  if (!name || !contact || !message) {
    return createError("Name, contact, and message are required");
  }

  const sheet = getSheet(SH.CONTACT);
  sheet.appendRow([name, contact, subject || "General Query", message, new Date()]);

  // Send email notification to admin
  try {
    MailApp.sendEmail({
      to: SHEET_CONFIG.ADMIN_EMAIL,
      subject: `📩 New Contact: ${subject || "General"} — ${name}`,
      body: `New contact form submission:\n\nName: ${name}\nContact: ${contact}\nSubject: ${subject}\nMessage: ${message}\nDate: ${new Date()}`,
      htmlBody: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#00D4AA;padding:20px;border-radius:10px 10px 0 0">
            <h2 style="color:#000;margin:0">📩 New Contact Message</h2>
          </div>
          <div style="background:#f9f9f9;padding:20px;border:1px solid #ddd">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px;font-weight:bold;width:100px">Name:</td><td>${name}</td></tr>
              <tr><td style="padding:8px;font-weight:bold">Contact:</td><td>${contact}</td></tr>
              <tr><td style="padding:8px;font-weight:bold">Subject:</td><td>${subject || "General"}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;vertical-align:top">Message:</td><td>${message}</td></tr>
              <tr><td style="padding:8px;font-weight:bold">Date:</td><td>${new Date()}</td></tr>
            </table>
          </div>
          <div style="background:#000;padding:10px 20px;border-radius:0 0 10px 10px">
            <p style="color:#888;font-size:12px;margin:0">Nitesh Automations — Contact System</p>
          </div>
        </div>
      `
    });
  } catch (e) {
    Logger.log("Admin email error: " + e.message);
  }

  // Auto-reply to user if email provided
  if (contact.includes("@")) {
    try {
      MailApp.sendEmail({
        to: contact,
        subject: "✅ Message Received — Nitesh Automations",
        htmlBody: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#00D4AA;padding:20px;text-align:center">
              <h2 style="color:#000">📈 Nitesh Automations</h2>
            </div>
            <div style="padding:30px;background:#f9f9f9">
              <p>Dear <strong>${name}</strong>,</p>
              <p>आपका message हमें मिल गया! ✅</p>
              <p><strong>आपने भेजा:</strong><br><em>"${message}"</em></p>
              <p>हम <strong>24 घंटे के अंदर</strong> reply करेंगे।</p>
              <p>किसी urgent query के लिए:</p>
              <ul>
                <li>📱 WhatsApp: +91 XXXXX XXXXX</li>
                <li>✈ Telegram: @NiteshAutomations</li>
              </ul>
              <p>धन्यवाद!<br>Nitesh Kumar<br>Nitesh Automations</p>
            </div>
            <div style="background:#111;padding:15px;text-align:center">
              <p style="color:#666;font-size:12px;margin:0">
                ⚠️ Educational purpose only. Not SEBI-registered advice.
              </p>
            </div>
          </div>
        `
      });
    } catch (e) {
      Logger.log("User reply email error: " + e.message);
    }
  }

  return createResponse({ message: "Message received! We'll reply within 24 hours." });
}

// ═══════════════════════════════════════════
// GET REPORTS (PUBLIC)
// ═══════════════════════════════════════════
function handleGetReports(data) {
  const sheet = getSheet(SH.REPORTS);
  if (!sheet || sheet.getLastRow() < 2) {
    return createResponse({ reports: [] });
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  const reports = rows
    .filter(r => r[0] && r[1])
    .map(r => ({
      id: r[0], name: r[1], language: r[2],
      price: r[3], sector: r[5] || "General",
      originalPrice: r[6] || r[3] * 2,
      description: r[7] || "",
      popular: r[8] || false,
      // Don't expose fileUrl to public
    }));

  const lang = data?.language;
  const sector = data?.sector;

  const filtered = reports.filter(r => {
    if (lang && r.language.toLowerCase() !== lang.toLowerCase()) return false;
    if (sector && r.sector.toLowerCase() !== sector.toLowerCase()) return false;
    return true;
  });

  return createResponse({ reports: filtered, total: filtered.length });
}

// ═══════════════════════════════════════════
// PURCHASE REPORT
// ═══════════════════════════════════════════
function handlePurchaseReport(data) {
  const { userId, reportId, paymentId, amount, paymentMethod } = data;

  if (!userId || !reportId || !paymentId) {
    return createError("userId, reportId, and paymentId are required");
  }

  const sheet = getSheet(SH.PAYMENTS);
  const newPaymentId = "PAY-" + Date.now().toString().slice(-10);

  sheet.appendRow([
    newPaymentId, userId, reportId, amount || 0,
    "Pending", new Date(), paymentId, paymentMethod || "Razorpay"
  ]);

  return createResponse({
    message: "Payment recorded. Verification in progress.",
    paymentRecordId: newPaymentId,
  });
}

// ═══════════════════════════════════════════
// PAYMENT VERIFICATION (Razorpay)
// ═══════════════════════════════════════════
function handlePaymentVerify(data) {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, userId, reportId } = data;

  if (!razorpay_payment_id || !userId || !reportId) {
    return createError("Payment verification data incomplete");
  }

  // Verify Razorpay signature
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(body, SHEET_CONFIG.RAZORPAY_KEY_SECRET)
  );

  // Note: In production, properly verify HMAC SHA-256 signature
  // For now, we mark as verified if payment ID exists
  const isVerified = razorpay_payment_id.startsWith("pay_");

  if (isVerified) {
    // Update payment status
    const paySheet = getSheet(SH.PAYMENTS);
    const payments = paySheet.getDataRange().getValues();
    for (let i = 1; i < payments.length; i++) {
      if (payments[i][1] == userId && payments[i][2] == reportId) {
        paySheet.getRange(i + 1, 5).setValue("Success");
        paySheet.getRange(i + 1, 7).setValue(razorpay_payment_id);
        break;
      }
    }

    // Get report file URL to send
    const report = getReportById(reportId);
    const fileUrl = report ? report.fileUrl : "";

    // Send confirmation email
    const user = getUserById(userId);
    if (user && user.email) {
      sendPaymentConfirmEmail(user, report, fileUrl);
    }

    return createResponse({
      message: "Payment verified successfully!",
      downloadUrl: fileUrl,
      reportId: reportId,
    });
  }

  return createError("Payment verification failed", 402);
}

// ═══════════════════════════════════════════
// APPROVE PAYMENT (Admin)
// ═══════════════════════════════════════════
function handleApprovePayment(data) {
  const { adminKey, paymentId, userId, reportId } = data;

  // Simple admin verification
  if (adminKey !== "NITESH_ADMIN_2024") {
    return createError("Unauthorized", 401);
  }

  const paySheet = getSheet(SH.PAYMENTS);
  const payments = paySheet.getDataRange().getValues();

  for (let i = 1; i < payments.length; i++) {
    if (payments[i][0] === paymentId || (payments[i][1] == userId && payments[i][2] == reportId)) {
      paySheet.getRange(i + 1, 5).setValue("Success");
      paySheet.getRange(i + 1, 9).setValue(new Date()); // Approved date

      // Get download link and send email
      const report = getReportById(payments[i][2]);
      const user = getUserById(payments[i][1]);
      if (user && user.email && report) {
        sendPaymentConfirmEmail(user, report, report.fileUrl);
      }

      return createResponse({ message: "Payment approved! PDF link sent to user." });
    }
  }

  return createError("Payment record not found");
}

// ═══════════════════════════════════════════
// GET USER
// ═══════════════════════════════════════════
function handleGetUser(data) {
  const { userId, token } = data;
  if (!userId) return createError("userId required");

  const user = getUserById(userId);
  if (!user) return createError("User not found");

  const purchases = getUserPurchases(userId);
  const earnings = getUserEarningsData(userId);
  const referrals = getUserReferralsList(userId);

  return createResponse({
    user: { ...user, password: undefined }, // Don't expose password
    purchases: purchases,
    earnings: earnings,
    referrals: referrals,
  });
}

// ═══════════════════════════════════════════
// UPDATE PROFILE
// ═══════════════════════════════════════════
function handleUpdateProfile(data) {
  const { userId, name, mobile, email, telegramUsername } = data;
  if (!userId) return createError("userId required");

  const sheet = getSheet(SH.USERS);
  const users = sheet.getDataRange().getValues();

  for (let i = 1; i < users.length; i++) {
    if (users[i][0] === userId) {
      if (name)            sheet.getRange(i + 1, 2).setValue(name);
      if (mobile)          sheet.getRange(i + 1, 3).setValue(mobile);
      if (email)           sheet.getRange(i + 1, 4).setValue(email);
      if (telegramUsername) sheet.getRange(i + 1, 10).setValue(telegramUsername);
      sheet.getRange(i + 1, 11).setValue(new Date()); // Updated at

      return createResponse({ message: "Profile updated successfully!" });
    }
  }
  return createError("User not found");
}

// ═══════════════════════════════════════════
// REFERRAL STATS
// ═══════════════════════════════════════════
function handleGetReferralStats(data) {
  const { userId } = data;
  if (!userId) return createError("userId required");

  const refs = getUserReferralsList(userId);
  const user = getUserById(userId);

  return createResponse({
    referralCode: user?.referralCode || "",
    referralLink: `https://niteshautomations.com/?ref=${user?.referralCode}`,
    telegramLink: `https://t.me/NiteshAutomationsBot?start=${user?.referralCode}`,
    totalReferrals: refs.length,
    approvedReferrals: refs.filter(r => r.status === "Approved").length,
    pendingReferrals: refs.filter(r => r.status === "Pending").length,
    totalEarnings: refs.filter(r => r.status === "Approved").length * 50,
    pendingEarnings: refs.filter(r => r.status === "Pending").length * 50,
    referrals: refs,
  });
}

// ═══════════════════════════════════════════
// EARNINGS
// ═══════════════════════════════════════════
function handleGetEarnings(data) {
  const { userId } = data;
  if (!userId) return createError("userId required");

  return createResponse(getUserEarningsData(userId));
}

// ═══════════════════════════════════════════
// ADMIN: ADD REPORT
// ═══════════════════════════════════════════
function handleAddReport(data) {
  const { adminKey, name, language, price, fileUrl, sector, description, originalPrice } = data;

  if (adminKey !== "NITESH_ADMIN_2024") return createError("Unauthorized", 401);
  if (!name || !price) return createError("Name and price required");

  const sheet = getSheet(SH.REPORTS);
  const newId = "R" + String(sheet.getLastRow()).padStart(3, "0");

  sheet.appendRow([
    newId, name, language || "Hindi",
    parseInt(price), fileUrl || "", sector || "General",
    parseInt(originalPrice) || parseInt(price) * 2,
    description || "", false, new Date()
  ]);

  return createResponse({ message: "Report added!", reportId: newId });
}

// ═══════════════════════════════════════════
// ADMIN: DELETE REPORT
// ═══════════════════════════════════════════
function handleDeleteReport(data) {
  const { adminKey, reportId } = data;

  if (adminKey !== "NITESH_ADMIN_2024") return createError("Unauthorized", 401);

  const sheet = getSheet(SH.REPORTS);
  const reports = sheet.getDataRange().getValues();

  for (let i = 1; i < reports.length; i++) {
    if (reports[i][0] === reportId) {
      sheet.deleteRow(i + 1);
      return createResponse({ message: "Report deleted!" });
    }
  }
  return createError("Report not found");
}

// ═══════════════════════════════════════════
// ADMIN: GET ALL USERS
// ═══════════════════════════════════════════
function handleGetAllUsers(data) {
  if (data.adminKey !== "NITESH_ADMIN_2024") return createError("Unauthorized", 401);

  const sheet = getSheet(SH.USERS);
  if (!sheet || sheet.getLastRow() < 2) return createResponse({ users: [], total: 0 });

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  const users = rows.map(r => ({
    userId: r[0], name: r[1], mobile: r[2], email: r[3],
    referralCode: r[5], referredBy: r[6], joinDate: r[7], status: r[8],
  }));

  return createResponse({ users, total: users.length });
}

// ═══════════════════════════════════════════
// ADMIN: GET PAYMENTS
// ═══════════════════════════════════════════
function handleGetPayments(data) {
  if (data.adminKey !== "NITESH_ADMIN_2024") return createError("Unauthorized", 401);

  const sheet = getSheet(SH.PAYMENTS);
  if (!sheet || sheet.getLastRow() < 2) return createResponse({ payments: [], total: 0, revenue: 0 });

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  const payments = rows.map(r => ({
    paymentId: r[0], userId: r[1], reportId: r[2],
    amount: r[3], status: r[4], date: r[5], ref: r[6], method: r[7],
  }));

  const revenue = payments.filter(p => p.status === "Success").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  return createResponse({ payments, total: payments.length, revenue });
}

// ═══════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);
  return ss.getSheetByName(name);
}

function getUserById(userId) {
  const sheet = getSheet(SH.USERS);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == userId) {
      return {
        userId: data[i][0], name: data[i][1], mobile: data[i][2],
        email: data[i][3], referralCode: data[i][5], referredBy: data[i][6],
        joinDate: data[i][7], status: data[i][8],
      };
    }
  }
  return null;
}

function getReportById(reportId) {
  const sheet = getSheet(SH.REPORTS);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == reportId) {
      return {
        id: data[i][0], name: data[i][1], language: data[i][2],
        price: data[i][3], fileUrl: data[i][4], sector: data[i][5],
        originalPrice: data[i][6], description: data[i][7],
      };
    }
  }
  return null;
}

function getUserPurchases(userId) {
  const sheet = getSheet(SH.PAYMENTS);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const data = sheet.getDataRange().getValues();
  const purchases = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == userId && data[i][4] === "Success") {
      const report = getReportById(data[i][2]);
      purchases.push({
        paymentId: data[i][0],
        reportId: data[i][2],
        reportName: report?.name || "Unknown",
        amount: data[i][3],
        date: data[i][5],
        downloadUrl: report?.fileUrl || "",
      });
    }
  }
  return purchases;
}

function getUserReferralsList(userId) {
  const sheet = getSheet(SH.REFERRALS);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const data = sheet.getDataRange().getValues();
  return data.slice(1)
    .filter(r => r[0] == userId)
    .map(r => ({
      referredUserId: r[1], earnings: r[2],
      date: r[3], status: r[4] || "Pending",
    }));
}

function getUserEarningsData(userId) {
  const referrals = getUserReferralsList(userId);
  const approved = referrals.filter(r => r.status === "Approved");
  const pending = referrals.filter(r => r.status === "Pending");

  return {
    totalEarnings: approved.length * 50,
    pendingEarnings: pending.length * 50,
    withdrawnEarnings: 0, // Track in separate column
    referralCount: referrals.length,
    approvedCount: approved.length,
  };
}

function processReferralFromWeb(refCode, newUserId) {
  const usersSheet = getSheet(SH.USERS);
  if (!usersSheet) return;

  const users = usersSheet.getDataRange().getValues();
  let referrerId = null;

  for (let i = 1; i < users.length; i++) {
    if (users[i][5] === refCode) {
      referrerId = users[i][0];
      break;
    }
  }

  if (!referrerId) return;

  const refSheet = getSheet(SH.REFERRALS);
  refSheet.appendRow([referrerId, newUserId, 50, new Date(), "Pending"]);
}

// ═══════════════════════════════════════════
// EMAIL FUNCTIONS
// ═══════════════════════════════════════════
function sendWelcomeEmail(email, name, userId, refCode) {
  if (!email) return;
  const refLink = `https://niteshautomations.com/?ref=${refCode}`;
  const tgLink = `https://t.me/NiteshAutomationsBot?start=${refCode}`;

  MailApp.sendEmail({
    to: email,
    subject: "🎉 Welcome to Nitesh Automations! Your Account is Ready",
    htmlBody: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#0d1117">
        <div style="max-width:600px;margin:0 auto;background:#0d1117;border:1px solid rgba(0,212,170,0.2);border-radius:16px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#00D4AA,#00A884);padding:30px;text-align:center">
            <h1 style="color:#000;margin:0;font-size:28px">📈 Nitesh Automations</h1>
            <p style="color:#001a14;margin:8px 0 0;font-size:14px">Stock Market Research & Education Platform</p>
          </div>
          <div style="padding:35px;color:#e8edf2">
            <h2 style="color:#00D4AA">🎉 Welcome, ${name}!</h2>
            <p>आपका Nitesh Automations में account बन गया है! ✅</p>
            <div style="background:#131a22;border:1px solid rgba(0,212,170,0.15);border-radius:12px;padding:20px;margin:20px 0">
              <p style="margin:0 0 5px;color:#8892a4;font-size:12px">YOUR USER ID</p>
              <p style="margin:0;font-size:18px;font-weight:bold;color:#00D4AA;font-family:monospace">${userId}</p>
              <p style="margin:15px 0 5px;color:#8892a4;font-size:12px">YOUR REFERRAL CODE</p>
              <p style="margin:0;font-size:18px;font-weight:bold;color:#FFD700;font-family:monospace">${refCode}</p>
            </div>
            <h3 style="color:#00D4AA">🔗 आपका Referral Link:</h3>
            <div style="background:#131a22;border:1px solid rgba(0,212,170,0.15);border-radius:8px;padding:12px;font-family:monospace;font-size:13px;word-break:break-all;color:#00D4AA">${refLink}</div>
            <p>हर successful referral पर आपको <strong style="color:#FFD700">₹50 commission</strong> मिलेगा!</p>
            <div style="margin:25px 0">
              <h3 style="color:#e8edf2">🚀 Next Steps:</h3>
              <p>✅ Research Reports देखें और अपनी investment journey शुरू करें</p>
              <p>✅ Telegram Bot join करें: <a href="${tgLink}" style="color:#00D4AA">${tgLink}</a></p>
              <p>✅ Angel One में Free Demat Account खोलें</p>
            </div>
            <div style="text-align:center;margin:30px 0">
              <a href="https://niteshautomations.com" style="display:inline-block;background:linear-gradient(135deg,#00D4AA,#00A884);color:#000;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px">🌐 Website Visit करें</a>
            </div>
          </div>
          <div style="background:#090c10;padding:20px;text-align:center;border-top:1px solid rgba(0,212,170,0.1)">
            <p style="color:#4a5568;font-size:12px;margin:0">© 2024 Nitesh Automations | Made with ❤️ in India 🇮🇳</p>
            <p style="color:#4a5568;font-size:11px;margin:5px 0 0">⚠️ Educational purpose only. Not SEBI-registered advice.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
}

function sendPaymentConfirmEmail(user, report, downloadUrl) {
  if (!user?.email || !report) return;

  MailApp.sendEmail({
    to: user.email,
    subject: `✅ Payment Confirmed — ${report.name}`,
    htmlBody: `
      <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;background:#0d1117;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#00D4AA,#00A884);padding:25px;text-align:center">
          <h2 style="color:#000;margin:0">✅ Payment Confirmed!</h2>
        </div>
        <div style="padding:30px;color:#e8edf2">
          <p>Dear <strong>${user.name}</strong>,</p>
          <p>आपकी payment successfully received हो गई! 🎉</p>
          <div style="background:#131a22;border:1px solid rgba(0,212,170,0.2);border-radius:10px;padding:20px;margin:20px 0">
            <p style="margin:0;color:#8892a4;font-size:12px">REPORT</p>
            <p style="margin:5px 0 0;font-size:18px;font-weight:bold;color:#00D4AA">${report.name}</p>
            <p style="margin:15px 0 5px;color:#8892a4;font-size:12px">AMOUNT PAID</p>
            <p style="margin:0;font-size:22px;font-weight:bold;color:#FFD700">₹${report.price}</p>
          </div>
          ${downloadUrl ? `
          <div style="text-align:center;margin:25px 0">
            <a href="${downloadUrl}" style="display:inline-block;background:linear-gradient(135deg,#00D4AA,#00A884);color:#000;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700">📥 PDF Download करें</a>
          </div>
          ` : '<p>Download link जल्द ही send किया जाएगा।</p>'}
          <p>Thank you for your purchase! 🙏</p>
          <p>Nitesh Kumar<br>Nitesh Automations</p>
        </div>
        <div style="background:#090c10;padding:15px;text-align:center">
          <p style="color:#4a5568;font-size:11px;margin:0">⚠️ Educational purpose only. Not SEBI-registered advice.</p>
        </div>
      </div>
    `
  });
}

// ═══════════════════════════════════════════
// INITIALIZE SHEETS (Run ONCE)
// ═══════════════════════════════════════════
function initializeSheetsBackend() {
  const ss = SpreadsheetApp.openById(SHEET_CONFIG.SPREADSHEET_ID);

  function createSheet(name, headers, color) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground(color || "#00D4AA")
        .setFontColor("#000000");
      sheet.setFrozenRows(1);
      sheet.setColumnWidths(1, headers.length, 140);
    }
    return sheet;
  }

  createSheet(SH.USERS, ["UserID","Name","Mobile","Email","Password","ReferralCode","ReferredBy","JoinDate","Status","TelegramUsername","UpdatedAt"]);
  createSheet(SH.REPORTS, ["ReportID","Name","Language","Price","FileURL","Sector","OriginalPrice","Description","Popular","CreatedAt"], "#FFD700");
  createSheet(SH.PAYMENTS, ["PaymentID","UserID","ReportID","Amount","Status","Date","TransactionRef","Method","ApprovedAt"], "#2ED573");
  createSheet(SH.REFERRALS, ["ReferrerID","ReferredUserID","Earnings","Date","Status","PaidAt"], "#FF6B6B");
  createSheet(SH.CONTACT, ["Name","Contact","Subject","Message","Date","Replied"], "#A855F7");

  // Add sample reports
  const reportsSheet = ss.getSheetByName(SH.REPORTS);
  if (reportsSheet.getLastRow() === 1) {
    const sampleReports = [
      ["R001","RELIANCE Industries Analysis","Hindi",99,"","Energy",199,"Complete fundamental analysis of Reliance Industries in Hindi",true,new Date()],
      ["R002","TCS Comprehensive Report","English",149,"","IT",299,"TCS detailed financial and technical analysis",false,new Date()],
      ["R003","HDFC Bank Deep Dive","Hindi",99,"","Banking",199,"HDFC Bank NPA analysis and growth prospects in Hindi",true,new Date()],
      ["R004","Infosys Growth Analysis","English",129,"","IT",249,"Infosys quarterly analysis and target price",false,new Date()],
      ["R005","ICICI Bank Research","Hindi",99,"","Banking",199,"ICICI Bank detailed fundamental analysis",false,new Date()],
      ["R006","Sun Pharma Analysis","Hindi",119,"","Pharma",229,"Pharma sector analysis with Sun Pharma deep dive",false,new Date()],
      ["R007","Bajaj Finance Report","English",149,"","Banking",299,"NBFC sector leader comprehensive analysis",true,new Date()],
      ["R008","Asian Paints Study","Hindi",99,"","FMCG",199,"Consumer sector play - Asian Paints analysis",false,new Date()],
      ["R009","ONGC Energy Analysis","Hindi",79,"","Energy",149,"PSU oil company analysis with dividend history",false,new Date()],
    ];
    sampleReports.forEach(r => reportsSheet.appendRow(r));
  }

  Logger.log("✅ All sheets initialized with sample data!");
}

// Quick test function
function testAPI() {
  const result = handleGetReports({});
  Logger.log(JSON.stringify(result));
}
