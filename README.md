# Liquor Store Audit Web App (Responsive + OCR PDF Upload)

This is a Next.js (App Router) web app for auditing liquor store daily sales sheets.

## Features
- **Admin page**
  - Create stores
  - Create 4-digit user codes linked to stores
  - Disable/enable codes
  - Rotate/reset codes
- **User page**
  - Mobile-first UI with summary cards
  - Upload today's scanned PDF sheet
  - Client-side OCR extracts totals + line items and updates UI immediately
  - Laptop view splits into two halves: summary/upload on left, balance sheet on right
  - **One upload/save per store per date** (prevents accidental overwrites)
  - **Date selector** to load prior audits
  - **Monthly export** (CSV download)

## Tech
- Next.js + TypeScript + Tailwind
- Supabase Postgres
- Client-side OCR: pdfjs-dist + tesseract.js
- Simple cookie session (JWT) via jose

---

## 1) Create Supabase project (free tier)
1. Create a project in Supabase.
2. In **SQL Editor**, run `supabase/schema.sql` from this repo.
3. In **Project Settings → API**, copy:
   - Project URL
   - `anon` key
   - `service_role` key

---

## 2) Configure env vars
Copy `.env.example` to `.env.local` and fill in values.

---

## 3) Run locally
```bash
npm i
npm run dev
```
Open http://localhost:3000

---

## 4) Admin access
Go to `/admin` and enter the password set in `ADMIN_PASSWORD`.

## 5) User workflow
- Login with your store's 4-digit code
- Upload the day's PDF (fields auto-fill)
- Optionally edit values
- Choose the audit date (date picker)
- Click **Save**

To view an earlier day: pick a date and click **Load**.

To export: pick a month and it downloads a CSV.

---

## 6) Deploy (zero-cost friendly)
### Option A: Vercel + Supabase (recommended)
- Push this repo to GitHub
- Import into Vercel
- Add the same env vars in Vercel project settings
- Deploy

Client-side OCR keeps server costs near zero.

---

## Notes
- A plain 4-digit code is weak security. This app includes basic rate limiting & disable/rotate, but consider adding a second factor later.
