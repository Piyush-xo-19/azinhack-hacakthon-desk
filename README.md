# AZINHACK

QR-based hackathon operations: participant imports, attendance, lunch and goodies, unique QR passes and email/WhatsApp delivery adapters.

This branch (`deploy/vercel`) is the Vercel migration. The original private Sites deployment is preserved on `master` and has not been redeployed from this branch.

See `DEPLOY-VERCEL.md` for the complete Windows deployment steps. Vercel uses standard Next.js with a remote libSQL/Turso database and staff email/password login. Required environment variables: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET`, and `STAFF_ACCOUNTS_BASE64` (or a manually configured `STAFF_ACCOUNTS` JSON array).

Quick setup: `npm install`, `npm run setup:staff`, add database settings in ignored `.env.local`, then `npm run db:migrate`, `npm test`, and `npm run build`. Use `npm run dev` for local preview. Do not commit `.env.local`, participant exports or database files.

Re-importing a matching email updates contact details while preserving the existing participant ID, QR token and checkpoint records. Claims are atomic and unique per participant/checkpoint. Attendance is required before lunch and goodies. QR tokens contain random identifiers rather than contact details.

All configured staff accounts currently have organizer access. Create them only for trusted staff. No public registration endpoint is implemented. Sender adapters remain disabled until credentials are configured; provider acceptance is recorded, while delivery receipts and bulk sending are not implemented.

The isolated production smoke test is `node scripts/test-vercel-local.mjs`. It creates synthetic staff and participants in an ignored local database, tests login and rate limiting, rejects spoofed identity headers and cross-origin requests, verifies concurrent duplicate checks and re-import stability, and round-trips a generated QR image. It never sends messages. An actual remote database and phone camera still need event-day checks after deployment.

Local commits are created automatically for completed verified milestones, as requested. There is no configured GitHub remote. Deploy using the Vercel CLI or connect your own repository.

Scanner capture requests 1920x1080 where available and applies autofocus only when advertised by the camera. The preview preserves its full captured frame. After permission, users can choose another lens; supported devices also offer refocus and a camera light. Decoding is capped separately at 1280 pixels on the longest side to keep phones responsive. Optional focus/light failures do not prevent scanning. Automated camera tests use mocked media devices; actual lens quality and focus need testing on the volunteer phones.
