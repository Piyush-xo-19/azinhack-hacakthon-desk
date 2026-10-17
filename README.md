# AZINHACK

QR-based hackathon operations: participant CSV imports, attendance, lunch and goodies, unique QR passes, and email/WhatsApp provider adapters. Next.js runs on Vercel with shared Turso/libSQL records.

This branch replaces password authentication with Google OpenID Connect. Only verified Google accounts in `STAFF_ALLOWED_EMAILS` can access organizer operations. Authorization uses code flow with PKCE, state, nonce and signed ID-token verification. Sessions expire after 12 hours; the allowlist is checked on every request. Legacy password cookies and the password endpoint cannot grant access.

See `DEPLOY-VERCEL.md` for Google client setup and deployment. Configure ignored `.env.local` using `.env.example`, then run `npm install`, `npm run db:migrate`, `npm test` and `npm run build`. Vercel runs `npm run build:vercel` to apply checksum-tracked schema migrations before building. Use separate databases and OAuth configuration for previews.

Re-importing a matching email updates contact details while preserving the participant ID, QR token and checkpoint records. Claims are atomic and unique per participant/checkpoint. Attendance is required before lunch and goodies. QR tokens contain random identifiers rather than contact details.

All allowlisted staff have organizer access. Sender adapters remain disabled until configured. Provider acceptance is recorded; delivery receipts and bulk dispatch are not implemented. Never commit participant data, OAuth client JSON, environment files or databases.

`npm test` covers event rules, camera behavior and OIDC grant validation with mocked provider responses. After building, `node scripts/test-vercel-local.mjs --prefix` checks an isolated production server with synthetic sessions and records: authorization, retired password login, callback rejection, logout CSRF, concurrent claims, import stability and QR decoding. Real Google account sign-in and physical phone cameras still need deployment checks.

Scanner capture requests 1920x1080 where available and applies supported autofocus. Users can select a lens, refocus and enable a supported camera light. Decoding is capped separately at 1280 pixels to keep phones responsive.

Verified milestones are committed automatically. Repository: https://github.com/Piyush-xo-19/azinhack-hacakthon-desk . The original Sites version remains on `master`. Production stays on `deploy/vercel` until Google credentials and the OIDC rollout are verified.
