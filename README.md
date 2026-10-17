# Hackathon Desk

A private organizer dashboard for QR check-in, lunch and goodies, built with React/Vinext and Cloudflare D1. Source lives in `C:/Users/LENOVO/Desktop/azinhack`.

## Included

- Import up to 1,000 participants per CSV with a column mapping preview.
- Match by lowercased email on future imports; preserve pass IDs and collection records.
- Generate/download unique PNG QR passes locally, without transmitting tokens to a QR service.
- Camera scanning, QR image upload, USB-scanner input and email/phone/name lookup.
- Require attendance before lunch/goodies; database uniqueness prevents duplicate collection across counters.
- Shared database, ten-second roster refresh, operator attribution and IST timestamps.
- Download a CSV attendance/collection report.
- Resend email attachment and WhatsApp Business image-template delivery adapters. Disabled until configured. Provider acceptance is recorded; final delivery receipts are not implemented.

## Local development

Node 22.13+ and Git are required. Install dependencies with `npm install`, then `npm run db:generate` after schema changes. Build with `npm run build`. Apply each generated SQL migration once using:

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_<generated_name>.sql
```

Start `npm run dev` and open the printed loopback URL. The portable starter's `/signin-with-chatgpt?return_to=/` route provides a mock local organizer identity. Hosted sign-in is enforced by Sites; the initial deployment stays owner-private. Local and hosted databases are separate. Never import real participant data into Git.

## Participant CSV

Required columns: name, email, phone. Optional: team. Different Unstop header names can be mapped during import. Save phone numbers as text with their country code (for example 919876543210); scientific notation is rejected. The app accepts CSV, not direct XLSX or a live Unstop integration. Imports can be rerun safely by email; changing an email creates a new participant, so resolve email corrections before importing them.

## Sender setup before event use

Configure server-side runtime variables through Sites, not source or browser storage. See `.env.example` for variable names. Local secrets can use an ignored `.dev.vars` file.

Email uses `RESEND_API_KEY` and a verified `EMAIL_FROM` address. WhatsApp uses `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_TEMPLATE_NAME` and optionally `WHATSAPP_TEMPLATE_LANGUAGE` (default `en`). The approved template must have an IMAGE header and exactly one text body variable (participant name). Use participants who have opted in to event messages. Verify a test QR arrives and scans through both channels before a real send.

A send is explicit per participant. No bulk dispatch or provider delivery/read receipt webhooks are implemented. An ambiguous network failure is marked unknown and blocked from automatic retries to reduce duplicate messages. Reconcile unknown/sending outcomes in the provider dashboard before a controlled retry. QR images are bearer passes: they contain a random identifier, not contact details. Scans never directly change records; the operator reviews and confirms a checkpoint.

## Access and readiness

The first hosted version is private to the owner. Volunteer invitation/roles, event-day load testing, offline queueing, multiple meal sessions, and pass revocation are not implemented. Organize supported private access for the volunteer team before using multiple phones. The organizer phones require internet to confirm writes; participants may show saved QR images offline. A forwarded QR can be used by another person, so volunteers should check the displayed participant name.

## Git

The user requested automatic local commits for completed milestones. Do not commit secrets, participant exports, database files or generated build output. Sites publication syncs source to the dedicated Sites repository; no GitHub remote is configured by this project.
