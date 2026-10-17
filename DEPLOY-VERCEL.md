# Google OIDC and Vercel setup

Production: https://azinhack-hacakthon-desk-yd7c.vercel.app

The `auth/google-oidc` branch replaces password sign-in. Switch production after the Google client and Vercel variables are ready.

## Google Web OAuth client

1. Open https://console.cloud.google.com/auth/clients and select or create an AZINHACK project.
2. Configure Google Auth Platform branding: app name AZINHACK and your support/contact email.
3. For personal Gmail, choose External audience. While in Testing, add `pg7267330@gmail.com` as a test user.
4. Use only sign-in scopes `openid`, `email`, `profile`.
5. Create an OAuth client: type **Web application**, name **AZINHACK Web**.
6. Register this exact authorized redirect URI:

```text
https://azinhack-hacakthon-desk-yd7c.vercel.app/api/auth/google/callback
```

7. Download the client JSON outside Git. Import it without printing the secret:

```powershell
cd C:\Users\LENOVO\Desktop\azinhack
npm.cmd run setup:google -- "C:\path\to\client_secret_download.json" pg7267330@gmail.com
```

This updates ignored `.env.local`, preserves an existing session secret and removes obsolete local password-account settings. It does not update Vercel. Google may require additional branding or verification steps depending on account policy and publication settings.

For local sign-in, register `http://localhost:3000/api/auth/google/callback` on a development client and set `APP_ORIGIN=http://localhost:3000`. Previews need their own matching registered callback and APP_ORIGIN.

## Production variables

- `APP_ORIGIN=https://azinhack-hacakthon-desk-yd7c.vercel.app`
- `GOOGLE_CLIENT_ID`: downloaded Web client ID
- `GOOGLE_CLIENT_SECRET`: downloaded Web client secret (sensitive)
- `STAFF_ALLOWED_EMAILS=pg7267330@gmail.com`
- `SESSION_SECRET`: retain the existing production secret (at least 32 random characters)
- `TURSO_ENV_PREFIX=azinhack_` for the current integration

Keep integration-managed `azinhack_TURSO_DATABASE_URL` and `azinhack_TURSO_AUTH_TOKEN` in Vercel. Unprefixed setups use TURSO_DATABASE_URL and TURSO_AUTH_TOKEN with an empty prefix. A comma-separated email allowlist can authorize more trusted organizers; all have full organizer permissions.

## Verify and deploy

```powershell
npm.cmd install
npm.cmd test
npm.cmd run build
node scripts/test-vercel-local.mjs --prefix
npx.cmd vercel deploy --prod
```

Use Node 24. Vercel runs `npm run build:vercel`, including schema migrations. A local build does not migrate a remote database. Integration tests use synthetic identities and an isolated SQLite database; they do not send messages or prove real Google access.

After deployment, verify organizer Google sign-in, rejection of a non-allowlisted Google account, sign-out, CSV import and checkpoint scanning. Once Google login works, remove obsolete STAFF_ACCOUNTS / STAFF_ACCOUNTS_BASE64 production variables and retire the old organizer password file. OIDC code ignores both legacy variables and cookies.

Email/WhatsApp still need sender credentials listed in `.env.example`. Authentication changes preserve participant data and QR identities.

Official reference: https://developers.google.com/identity/openid-connect/openid-connect
