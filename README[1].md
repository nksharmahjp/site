# 📈 NITESH AUTOMATIONS — Complete Business System
## Stock Market Research & Education Platform

![Version](https://img.shields.io/badge/version-1.0-00D4AA)
![Platform](https://img.shields.io/badge/platform-Web%20%7C%20Telegram-blue)
![License](https://img.shields.io/badge/license-Private-red)

---

## 🗂️ FILE STRUCTURE

```
nitesh-automations/
│
├── 📄 index.html              ← Complete Website (all pages in one file)
├── 📄 sitemap.xml             ← SEO sitemap
├── 📄 robots.txt              ← Search engine rules
│
├── 🤖 telegram-bot.gs        ← Telegram Bot (Google Apps Script)
├── 🔌 sheets-backend.gs      ← Web App API (registration, login, reports)
├── 💳 payment-webhook.gs     ← Razorpay webhook + email delivery
│
└── 📖 DEPLOYMENT-GUIDE.md    ← Full step-by-step setup guide
```

---

## ⚡ QUICK START (5 Steps)

### Step 1 — Google Sheets बनाएं
1. [sheets.google.com](https://sheets.google.com) → New Spreadsheet
2. Name: **"Nitesh Automations DB"**
3. URL से Sheet ID copy करें

### Step 2 — Apps Script Deploy करें
1. [script.google.com](https://script.google.com) → New Project
2. `sheets-backend.gs` + `telegram-bot.gs` + `payment-webhook.gs` paste करें
3. `SPREADSHEET_ID` update करें
4. `initializeSheetsBackend()` run करें (sheets बनाने के लिए)
5. **Deploy → Web App → Anyone** — URL copy करें

### Step 3 — Telegram Bot बनाएं
1. [@BotFather](https://t.me/BotFather) → `/newbot`
2. Token copy करें → `telegram-bot.gs` में `BOT_TOKEN` update करें
3. Apps Script में `setWebhook()` function run करें

### Step 4 — Website Host करें
```
Option A: netlify.com  → drag & drop index.html  (FREE ✅)
Option B: GitHub Pages → upload to repo           (FREE ✅)
Option C: Hostinger    → File Manager upload       (₹99/mo)
```

### Step 5 — Payments Setup करें
1. [razorpay.com](https://razorpay.com) → Account → API Keys
2. `index.html` में `YOUR_RAZORPAY_KEY` replace करें
3. Razorpay Dashboard → Webhooks → Apps Script Web App URL add करें

---

## 💰 REVENUE STREAMS

| Stream | Amount | Notes |
|--------|--------|-------|
| Research Reports | ₹49–₹299/report | Instant digital delivery |
| Angel One Referral | ₹500–₹2000/account | Per demat account opened |
| Google AdSense | CPM based | After AdSense approval |
| Excel Automation | ₹999–₹5000 | Custom project pricing |
| Tally Automation | ₹1499–₹8000 | Custom project pricing |
| User Referrals | ₹50/referral | Platform growth |

---

## 🌐 WEBSITE PAGES

| Page | Features |
|------|----------|
| 🏠 Home | Hero, ticker tape, Angel One CTA, testimonials, ads |
| 👤 About | Nitesh Kumar profile, experience, skills |
| ⚙️ Services | Research, Excel, Tally automation |
| 📊 Reports | Filter by language/sector, preview, buy |
| 🔐 Login | Mobile/email login + registration |
| 📊 Dashboard | Purchases, referrals, earnings, profile |
| ⚙️ Admin Panel | Users, reports, payments, referrals management |
| 📞 Contact | Form → Google Sheets + email notification |

---

## 🤖 TELEGRAM BOT COMMANDS

| Command | Function |
|---------|----------|
| `/start` | Register + welcome message |
| `/menu` | Main menu with buttons |
| `/reports` | List all available reports |
| `/demat` | Angel One referral link |
| `/earnings` | View earnings dashboard |
| `/referral` | Referral link + stats |
| `/support` | Contact support |
| `/help` | All commands list |

**Admin Only:**

| Command | Function |
|---------|----------|
| `/broadcast [msg]` | Send to all users |
| `/addreport Name\|Price\|Lang\|URL` | Add new report |
| `/stats` | Platform statistics |
| `/users` | Recent users list |

---

## 📊 GOOGLE SHEETS TABLES

| Sheet | Columns |
|-------|---------|
| **Users** | UserID, Name, Mobile, Email, Password, ReferralCode, ReferredBy, JoinDate, Status |
| **Reports** | ReportID, Name, Language, Price, FileURL, Sector, OriginalPrice, Description |
| **Payments** | PaymentID, UserID, ReportID, Amount, Status, Date, TransactionRef, Method |
| **Referrals** | ReferrerID, ReferredUserID, Earnings, Date, Status |
| **Contact** | Name, Contact, Subject, Message, Date |

---

## 🔗 IMPORTANT LINKS (Update These)

```javascript
// In index.html & telegram-bot.gs
WEBSITE_URL   = "https://niteshautomations.com"
TELEGRAM_BOT  = "https://t.me/NiteshAutomationsBot"
ANGEL_ONE_REF = "https://angel-one.onelink.me/Wjgr/YOUR_REF_CODE"
UPI_ID        = "yourname@upi"

// Social Media
YOUTUBE    = "https://youtube.com/@NiteshAutomations"
INSTAGRAM  = "https://instagram.com/NiteshAutomations"
FACEBOOK   = "https://facebook.com/NiteshAutomations"
TELEGRAM   = "https://t.me/NiteshAutomations"
LINKEDIN   = "https://linkedin.com/in/NiteshAutomations"
```

---

## 🔐 ADMIN CREDENTIALS

```
Default Admin Login:
Username: admin
Password: admin123

⚠️ IMPORTANT: Deploy करने से पहले change करें!
```

---

## ✅ FEATURES CHECKLIST

### Website
- [x] Responsive mobile-first design
- [x] Dark / Light mode toggle
- [x] Live stock ticker tape
- [x] Animated counter stats
- [x] Angel One referral banner
- [x] Reports with filter + search
- [x] Preview modal (before buy)
- [x] Razorpay + UPI payment modal
- [x] User registration + login
- [x] Client dashboard
- [x] Admin panel
- [x] Referral system
- [x] Earnings tracker
- [x] Contact form
- [x] Google Ads placeholders (×4)
- [x] SEBI disclaimer
- [x] SEO meta tags
- [x] Social media footer links
- [x] Toast notifications
- [x] Smooth page navigation

### Telegram Bot
- [x] User registration with referral tracking
- [x] Interactive inline keyboard menus
- [x] Report listing and preview
- [x] UPI payment flow
- [x] Razorpay redirect
- [x] Payment verification (manual + auto)
- [x] PDF auto-delivery after payment
- [x] Referral commission system
- [x] Earnings dashboard
- [x] Admin broadcast
- [x] Daily market updates
- [x] Admin stats command

### Backend (Google Apps Script)
- [x] User CRUD operations
- [x] Report management
- [x] Payment recording
- [x] Razorpay webhook handler
- [x] Referral commission processor
- [x] Welcome email automation
- [x] Payment confirmation email
- [x] Pending payment monitor
- [x] Daily revenue report
- [x] Time-based triggers

---

## 📞 SUPPORT

Having issues? Contact:
- 📱 WhatsApp: +91 XXXXX XXXXX
- ✈ Telegram: [@NiteshAutomations](https://t.me/NiteshAutomations)
- 📧 Email: nitesh@niteshautomations.com

---

## ⚠️ LEGAL DISCLAIMER

> This platform and all its content (research reports, market analysis, educational material) is strictly for **educational purposes only**.
> 
> **Nitesh Automations is NOT a SEBI-registered investment advisor.**
> 
> Stock market investments are subject to market risks. Please read all related documents carefully before investing. Past performance is not indicative of future results. Nitesh Automations and Nitesh Kumar are not responsible for any investment decisions made based on content from this platform.

---

*© 2024 Nitesh Automations | Made with ❤️ in India 🇮🇳*
