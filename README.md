# Salary Tracker

A personal web app to track and calculate your salary from daily work data — tests, kilometers, learning hours, and expenses.

---

## Features

- Log daily work entries (tests, km, learning hours, food & parking expenses)
- Real-time salary calculation with a live preview while filling the form
- Monthly dashboard showing earnings broken down per category
- Stats page showing test counts and kilometers for the month
- Send a formatted Excel report by email with one click
- Secure login / register with JWT authentication

---

## Salary Calculation Rules

| Component | Rate |
|---|---|
| Insurance test | 80 ₪ each |
| Screening test | 105 ₪ each |
| Mixed screening test | 120 ₪ each |
| Partial test | 50 ₪ each |
| Kilometers | 2 ₪/km + **100 ₪ bonus** if ≥ 100 km/day |
| Learning hours | 60 ₪/hour |
| Expenses (food + parking) | Actual cost reimbursed |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router |
| Backend | Node.js, Express |
| Database | SQLite (Node.js built-in `node:sqlite`) |
| Auth | JWT + bcrypt |
| Email | Nodemailer (Gmail) |
| Excel | ExcelJS |

---

## Prerequisites

- **Node.js v22.5 or higher** (v24 recommended — required for the built-in `node:sqlite` module)
- A Gmail account with **2-Step Verification** enabled
- A Gmail **App Password** (see [Configuration](#configuration))

---

## Installation

```bash
# 1. Navigate to the project folder
cd salary-tracker

# 2. Install backend dependencies
cd backend
npm install

# 3. Install frontend dependencies
cd ../frontend
npm install
```

---

## Configuration

Edit `backend/.env`:

```env
PORT=3001
JWT_SECRET=change-this-to-a-long-random-string
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

### Getting a Gmail App Password

1. Go to your Google Account → **Security**
2. Enable **2-Step Verification** if not already on
3. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Create a new App Password (e.g. name it "Salary Tracker")
5. Paste the 16-character password into `.env` as `GMAIL_APP_PASSWORD`

---

## Running the App

Open two terminals:

**Terminal 1 — Backend** (port 3001):
```bash
cd backend
node src/index.js
```

**Terminal 2 — Frontend** (port 5173):
```bash
cd frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## Usage

1. **Register** a new account on the login page
2. Click **+ Add Entry** to log a work day — fill in your tests, km, hours, and expenses
3. The form shows a live total as you type
4. The **Dashboard** shows a monthly summary with earnings per category
5. The **Stats** page shows how many tests you did and how many km you drove
6. Click **Send Report** to email a formatted Excel file to the configured address

---

## Project Structure

```
salary-tracker/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express server entry point
│   │   ├── db.js             # SQLite setup and schema
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT verification middleware
│   │   └── routes/
│   │       ├── auth.js       # Register and login
│   │       ├── entries.js    # Daily entries CRUD + summary
│   │       └── report.js     # Excel generation and email
│   ├── .env                  # Gmail credentials and config
│   └── salary.db             # SQLite database (auto-created)
└── frontend/
    └── src/
        ├── App.jsx            # Router and auth context
        ├── api.js             # Axios instance with JWT header
        ├── pages/
        │   ├── Login.jsx      # Login and register page
        │   ├── Dashboard.jsx  # Monthly summary and entry list
        │   ├── EntryPage.jsx  # Add / edit daily entry form
        │   └── StatsPage.jsx  # Monthly test counts and km stats
        └── components/
            ├── Navbar.jsx         # Top navigation bar
            └── MonthlySummary.jsx # Summary cards per category
```
