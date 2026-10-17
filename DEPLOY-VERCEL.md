# Deploy AZINHACK to Vercel (Windows PowerShell)

The Vercel code is on branch `deploy/vercel` in `C:/Users/LENOVO/Desktop/azinhack`. The previously deployed Sites version is preserved on `master`. The Vercel version uses Next.js, a remote libSQL/Turso database and staff email/password sign-in. The Codex Vercel plugin is optional.

## 1. Install and create your organizer account

Open PowerShell in the project folder:

```powershell
cd C:\Users\LENOVO\Desktop\azinhack
npm.cmd install
npm.cmd run setup:staff
```

Enter your organizer email and a password of at least 12 characters. Password input is hidden. The command creates or updates ignored `.env.local` with `SESSION_SECRET` and `STAFF_ACCOUNTS_BASE64`. Do not commit this file. Rerunning the command can add another staff account; all current staff accounts have organizer access.

## 2. Create a shared database

Create a libSQL-compatible database in the Turso dashboard at https://turso.tech. Copy its database URL and auth token. Add these lines to the existing `.env.local` file, keeping its generated organizer settings:

```dotenv
TURSO_DATABASE_URL=libsql://YOUR_DATABASE_HOST
TURSO_AUTH_TOKEN=YOUR_DATABASE_AUTH_TOKEN
```

The token and generated login configuration are secrets. Paste them into local configuration and Vercel settings, not chat or Git. A local SQLite file cannot hold durable shared records on Vercel.

## 3. Initialize and verify

```powershell
npm.cmd run db:migrate
npm.cmd test
npm.cmd run build
```

Migrations are tracked by name and checksum and can be safely rerun. Run migrations after pulling future schema updates, before deploying that code. Build uses Webpack to avoid the Windows junction permissions error encountered with Turbopack.

For a local check:

```powershell
npm.cmd run dev
```

Open the printed localhost URL and sign in with the email and password you created. Stop the server with Ctrl+C when done. The production login cookie requires HTTPS.

## 4. Sign in and create the Vercel project

```powershell
npx.cmd vercel login
npx.cmd vercel link
```

Complete sign-in in the browser. For linking: choose your account/team, choose to create a new project, name it `azinhack` (or an available name), and use the current directory. Framework is Next.js. Build command is `npm run build`; leave the output directory at its Next.js default. Use Node 24.x, or another Vercel-supported version meeting the package's minimum requirement.

## 5. Add the four required variables

In Vercel open your project, then Settings > Environment Variables. Add the following using the values from `.env.local`, for Production and Preview:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `SESSION_SECRET`
- `STAFF_ACCOUNTS_BASE64`

Copy the value after `=` exactly; do not include the variable name. The staff configuration is base64 of password hashes, not encryption; treat it as a secret. Use a separate database for previews if you will test destructive operations. The initial project has no participant data and no import happens during deployment.

## 6. Deploy

```powershell
npx.cmd vercel deploy --prod
```

Vercel prints the production URL. Open it and sign in with your organizer credentials. Verify CSV import, QR download, check-in, lunch and goodies. A repeat collection must be rejected. Test scanning on the actual volunteer phone over HTTPS before event day. Database and login variables are required for a working app; a successful build alone does not verify them.

## 7. Configure messages later

Email and WhatsApp remain disabled until sender variables are configured. See `.env.example` for names. Email uses Resend with a verified sender. WhatsApp requires a Business sender and an approved template with an image header and one text body variable for the participant name. Redeploy after changing Vercel environment variables.

Provider adapters track acceptance, not final delivery receipts. Bulk dispatch and volunteer roles are not implemented. Staff can access participant contact records and imports; only create accounts for trusted event staff. Existing Sites records are not migrated automatically. If real participant data was added there, export and plan its migration before using the Vercel app.

## Useful links

- Vercel deployment: https://vercel.com/docs/projects/deploy-from-cli
- Turso TypeScript reference: https://docs.turso.tech/sdk/ts/reference
