# Freelance Work & Billing Management Application

A complete web application tailored for freelancers to log work sessions, automatically calculate time, time discounts, gross & net earnings, view daily and monthly aggregations, generate client challans, and sync directly with Google Sheets.

---

## 🚀 Key Features

1. **Session-Level Tracking & Real-Time Calculation**:
   - **Date**, **Start Time**, **End Time**, **Total Time** (hours & minutes).
   - **Discount in Time** (in minutes): Deducted break/courtesy time.
   - **Total Effective Time**: `Total Time - Discount in Time`.
   - **Rate per Hour** in Rupees (₹).
   - **Client Name**, **Project Name**, and **Description of Work**.
   - **Money per session without discount**: `Total Time (hrs) * Rate`.
   - **Discount in Money**: `Discount in Time (hrs) * Rate`.
   - **Money per session with discount**: `Effective Time (hrs) * Rate`.

2. **Automated Daily Aggregations** (Supports multiple sessions per day):
   - Total time per day.
   - Total effective time per day.
   - Total money per day without discount.
   - Total discount per day (in time and money).
   - Total final net money per day (after subtracting discount).

3. **Automated Monthly Aggregations**:
   - Total monthly time & effective time.
   - Gross earnings without discount.
   - Total discount given in time & money.
   - Net final billable earnings for the month.
   - Active client list and working days count.

4. **Google Sheets Cloud Integration**:
   - **Append-only architecture**: Safely write new records to Google Sheets via the app without overwriting existing data.
   - **Read & Render**: Fetch all records across sheets and display them dynamically in the app with filters and search.
   - **Automatic Month Tab Creation**: When a session is logged in October 2026, the `2026-10` sheet tab is auto-created with stylized headers and column formatting.
   - **Multi-Year Support**: Monthly tabs are organized by `YYYY-MM` to transition smoothly across years.

5. **Role-Based Authentication (Stored in Google Sheet)**:
   - Dedicated `Users` tab in your Google Sheet stores credentials (`Username`, `Password`, `Role`).
   - `admin`: Full access to log sessions, sync with sheets, filter, and export.
   - `read`: Read-only viewer access (can view data, filter, and export reports, but cannot add entries).

6. **Export & Billing**:
   - **Excel Export (.xlsx)**: 3-tab workbook (`Sessions Ledger`, `Daily Summary`, `Monthly Summary`).
   - **PDF Report**: Branded table export with totals and filter scope.
   - **Client Challan**: Statement generator with line items, discount breakdown, and 1-click PDF download.

---

## 📋 Google Sheets Setup Guide (Takes 3 Minutes)

### Step 1: Open Your Google Sheet
1. Go to [Google Sheets](https://sheets.new) and create a new sheet (e.g., *Freelance Work Ledger*).

### Step 2: Open Google Apps Script
1. In the top menu, click **Extensions** > **Apps Script**.
2. Erase any code inside `Code.gs`.

### Step 3: Paste the Backend Script
Copy the script provided in `src/utils/googleSheetsScript.ts` (or from the **"Google Apps Script Code"** tab inside the app's Settings modal) and paste it into `Code.gs`.

### Step 4: Run Initializer (Optional)
In the toolbar, select `initSheet` from the function dropdown and click **Run**. This immediately creates the `Users` tab with default accounts:
- `admin` / `admin123` (Role: `admin`)
- `viewer` / `view123` (Role: `read`)

### Step 5: Deploy as Web App
1. Click **Deploy** > **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Configuration:
   - **Description**: `Freelance App API`
   - **Execute as**: `Me (<your-email>)`
   - **Who has access**: `Anyone` *(Note: This allows the web app to query the script, which internally validates credentials from the `Users` tab).*
4. Click **Deploy**.
5. Grant access permissions when prompted by Google.
6. Copy the generated **Web App URL** (ends in `/exec`).

### Step 6: Connect to the App
1. Open the application.
2. Click **Connect Sheet** or **Sheets Integration** in the sidebar.
3. Paste your Web App URL and click **Test Connection** &gt; **Save & Continue**.

---

## 🌐 Deploying to Netlify (Multi-Sheet Environment Variables)

When deploying this project on Netlify:

1. **Build Settings**:
   - **Build Command**: `npm run build`
   - **Publish directory**: `dist`

2. **Environment Variables**:
   In your Netlify Dashboard, navigate to **Site configuration** > **Environment variables** > **Add a variable**:
   - **Key**: `VITE_GOOGLE_SHEETS_URLS` *(or `GOOGLE_SHEETS_URLS`)*
   - **Value**: Provide your Google Apps Script Web App URLs separated by commas.

   **Examples**:
   - **Multiple plain URLs**:
     ```text
     https://script.google.com/macros/s/AKfycbzUwC-9ZPjAARznJCkS0FjBW12x01owiHhEN1IGFNkhT6UNb0l3xZcwj8SeAjDqhbvr/exec, https://script.google.com/macros/s/.../exec
     ```
   - **Labeled URLs (using pipe `|`)**:
     ```text
     2026 Primary Sheet|https://script.google.com/macros/s/AKfycbzUwC-9ZPjAARznJCkS0FjBW12x01owiHhEN1IGFNkhT6UNb0l3xZcwj8SeAjDqhbvr/exec, 2027 Future Sheet|https://script.google.com/macros/s/.../exec
     ```

3. **Behavior in the Application**:
   - The **first URL** is always loaded by default when the app opens.
   - All available sheet URLs appear directly in the **Active Sheet dropdown** located in the app's header topbar.
   - Switching sheets instantly loads and syncs records for that sheet.
   - All operations (logging sessions, viewing history, daily & monthly breakdowns, challan generation) automatically apply to whichever sheet is currently selected.
   - You can also add additional sheet URLs dynamically via the in-app **Sheets Management** modal without redeploying.

---

## 💻 Running the App Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

