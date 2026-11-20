# SmarklinkEdu

ระบบรวมลิงก์ระบบสารสนเทศของมหาวิทยาลัยสวนดุสิต ศูนย์การศึกษาลำปาง

## Technology

- Frontend: Next.js + TypeScript on Vercel
- Backend: Google Apps Script Web App
- Data store: Google Sheets created by the Apps Script initializer
- Logo storage: Google Drive
- Source control: GitHub `chookaittom-gif/Smartlinkedu`

## Features

- Public directory with search and category filters
- Admin login with a temporary first-run password and forced password change
- Create, edit, delete, and sort system links
- Update app name and upload the logo
- HttpOnly admin session cookie
- Vercel server-side API proxy; the GAS API secret is not exposed to the browser

## Setup

Follow [DEPLOYMENT.md](./DEPLOYMENT.md).

**Important:** the contents of `gas/Code.gs` must be pasted into the existing Google Apps Script project and deployed as a Web App. This repository cannot directly write to the Apps Script editor. Configure `GAS_WEB_APP_URL` and `GAS_API_SECRET` in Vercel, never in client-side code.
