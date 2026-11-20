# SmarklinkEdu deployment

## Architecture

- Next.js frontend and same-origin API proxy run on Vercel.
- Google Apps Script is the data/auth backend.
- Browser requests only `/api/gas`; the Vercel server adds `GAS_API_SECRET` and forwards requests to Apps Script.
- Admin session tokens are stored in an HttpOnly cookie and validated by GAS. The API secret is never sent to browser code.

## 1. Set up Google Apps Script

1. Open the Apps Script project supplied by the project owner.
2. Replace/add the contents of `gas/Code.gs` in the editor.
3. Run `initializeSmarklinkEdu` once from the Apps Script editor and approve the requested Spreadsheet/Drive permissions.
4. Open the execution log. Copy the generated `API_SECRET` to Vercel. The function also logs a one-time temporary admin password. Store it privately; the first login must replace it with a new password.
5. In Apps Script choose **Deploy → Manage deployments → Edit** the existing Web App deployment (or create a Web App deployment). Select **Execute as: Me** and **Who has access: Anyone**, then deploy a new version. Keep the same deployment URL when editing an existing deployment.
6. Run `initializeSmarklinkEdu` only once for the initial setup. It is safe to rerun for sheet header repair, but it does not reset existing records or admin credentials.

The current deployment URL supplied for this project is:
`https://script.google.com/macros/s/AKfycbxSTS9D35bVMYhTOiekDWrBsi7PdSGt-C7Eo666HygXT7jBOPv8xFxn3xpd0wakMShu/exec`

## 2. Configure Vercel

In Vercel Project → Settings → Environment Variables, add these for **Production**, **Preview**, and **Development** as appropriate:

- `GAS_WEB_APP_URL` = the Apps Script Web App URL ending in `/exec`
- `GAS_API_SECRET` = the `API_SECRET` printed by the Apps Script initialization function

Do not prefix these variables with `NEXT_PUBLIC_`. Never commit the values to GitHub. Redeploy after saving the environment variables.

## 3. Link GitHub to Vercel

Connect repository `chookaittom-gif/Smartlinkedu` in Vercel → Project Settings → Git. Set production branch to `main`. Each push to `main` will trigger a deployment once the integration is active.

## 4. First admin login

- Open `/admin` on the deployed site.
- Username is `admin`; use the one-time temporary password from the Apps Script execution log.
- Set a new password with at least 12 characters when prompted.
- Do not reuse a password previously shared in chat.

## 5. Notes

- The Systems and Settings sheets are created automatically by `initializeSmarklinkEdu`.
- The initial 11 directory records are seeded only when the Systems sheet is empty.
- Logo upload accepts PNG/JPG/WEBP up to 1 MB and creates a link-shared image in Google Drive.
- Apps Script API access is protected by the server-side secret. Do not share the secret or expose it in client-side code.
- The HTML/frontend cannot update the Apps Script editor automatically. Paste `gas/Code.gs` into the existing GAS project and redeploy it as described above.
