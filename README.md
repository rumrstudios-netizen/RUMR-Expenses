# Rumr Shoot Ledger — Vercel edition

Private production expense app using Next.js, Supabase Auth, Postgres and private Storage. Project/expense forms, optional descriptions, receipt upload, personal expense separation, CSV exports, configurable payment types and the Google Sheets bridge are retained.

## Deployment

Current production project: `rumr-shoot-ledger` in the `rumrstudios-9135` Vercel team. Source: `rumrstudios-netizen/RUMR-Expenses`, production branch `main`. Supabase project: `yfibayrehuyvcdmwfuoe` (Mumbai). The earlier `rumr-expenses` deployment was used for initial hosting checks. Use the Git-connected `rumr-shoot-ledger` project for ongoing releases.

1. Create a **private** GitHub repository named `RUMR-Expenses` and push this source to `main`. Never commit `.env` files, live data exports, credentials or receipts.
2. Create a Supabase project and apply `supabase/migrations/20261122072128_ledger.sql` through its SQL editor or migration tooling. It creates the RLS-protected ledger, membership allowlist and private `receipts` bucket (8 MB maximum).
3. In Supabase Auth, create the owner `rumrstudios@gmail.com` using Authentication → Users → Add user → Create new user, set their password privately, and enable Auto Confirm User. Other accounts require an explicit row in `allowed_members`. Keep public signup disabled. Application data and receipt policies enforce both approved membership and per-user ownership.
4. Import the private GitHub repository into Vercel. Framework: **Next.js**. Build: `npm run build`. Install: `npm ci`. Production branch: `main`.
5. Set these Vercel environment variables for Production and Preview:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   These are the project's public client identifiers, not a service-role key. Do not expose any service-role secret in the client.
6. Deploy, open `/login` and sign in with the approved owner account. Confirm `/api/health` reports `configured: true`, then test saving, editing, upload and CSV export on the real backend.

Git pushes to `main` trigger Vercel production deployment after the Git integration is connected. Pull requests receive preview deployments. `.github/workflows/checks.yml` runs data reconciliation tests, a production build and type checking. To make CI a merge requirement, enable branch protection in GitHub; the workflow itself does not configure that protection.

## Data and privacy

The website is served on Vercel, but records and receipts live in Supabase. Redeploying code does not recreate stored data. Receipt files upload directly to Supabase through server-issued signed upload tokens, avoiding a large multipart request through a Vercel function. Access still requires an approved, authenticated user. Files are checked against the expected signatures before attaching them to an expense.

Amounts remain integer paise; `null` means a missing amount, while `0` is a valid recorded amount. Unknown payment types are not guessed. Initial Kerala controls are 11 shoot expenses = ₹8,213 and two personal expenses = ₹138.

The existing ChatGPT-hosted site and its live data are untouched by this migration. The initial seed is only the previously extracted Kerala source, **not a fresh export of changes made on the live site**. Do not call the data migration complete until the full current ledger and all receipts have been exported, transferred and reconciled. The available database projection was truncated and was not used as a live backup. Receipt keys must be remapped from the old identity to the new Supabase user ID. Preserve original spreadsheet IDs if the Google bridge is already configured.

## Google Sheets

Google synchronization still requires the one-time Apps Script setup in the Google Sheets panel. Project creation and expense changes then sync one-way from this website. Manual edits in managed spreadsheet tabs are replaced on sync. Receipt files remain private in the website. Existing connection settings must be transferred securely during live data migration; never add them to Git.

## Remembered devices and PIN unlock

On the first visit in a browser, sign in with the approved account and choose a 6–12 digit device PIN. Later visits and page reloads show the PIN unlock screen. **Lock** ends the open visit without forgetting the device. **Workspace settings → Forget device & sign out** removes the saved sign-in and revokes the current Supabase session. **Forgot PIN / use another account** removes the local device setup and returns to account sign-in.

The browser stores only an AES-256-GCM encrypted access/refresh-token pair, protected by a PIN-derived PBKDF2-SHA256 key (600,000 iterations, random salt, fresh nonce per write). Account passwords and PINs are not stored. The decrypted session and key live only in page memory. Workspace APIs require a verified bearer token and the existing membership/ownership checks; old session cookies are not accepted and are cleared. Locked pages do not fetch ledger data. Refresh tokens are rotated and re-encrypted when needed, with browser Web Locks coordinating refreshes across tabs.

Device setup belongs to a browser and website origin, not every browser on the physical device. Clearing site data, changing domains, or using private browsing may require setup again. Supabase revocation/session expiry also requires account sign-in. A device PIN is a convenience lock, not an additional authentication factor or protection against a compromised browser; use a longer PIN on trusted devices. Forgotten PIN recovery does not remove projects or receipts.

Validation includes encryption/wrong-PIN/tamper tests and browser checks with mocked Supabase responses. Hosted account sign-in, token refresh, and receipt operations still require verification against the configured Supabase deployment before release.

## Local development

Copy `.env.example` to `.env.local` and fill in your Supabase public configuration. Run `npm ci`, `npm run dev`. The app uses real Supabase authentication in development as well as production: there is no development identity bypass.

Run `npm test`, `npm run build` and `npm run typecheck`. Build checks can run without connecting a backend; they do not establish that hosted login, RLS or upload works. Live verification remains a deployment step.

## Files for future changes

- `app/ledger.tsx` and `app/ledger.css`: dashboard and forms
- `app/api/store/route.ts`: validated ledger operations and Google sync
- `app/api/receipt/sign/route.ts`: authenticated signed upload creation
- `app/api/receipt/route.ts`: private receipt downloads
- `lib/supabase/`: browser/server authentication clients and membership checks
- `proxy.ts`: retire legacy auth cookies and prevent private response caching
- `app/unlock.tsx`, `app/workspace.tsx`, `lib/auth/`: device setup, PIN unlock, and encrypted token storage
- `supabase/migrations/`: database and Storage security policies

Keep the same Supabase project and bucket when updating the app. Add new migrations; do not rewrite applied migration history. The current workspace bounds remain 200 projects and 5,000 expenses. Preserve authentication and ownership checks when adding team workflows.

### Google Sheets without Apps Script

In Google Cloud, enable the Google Sheets API and configure the OAuth consent screen. Create a **Web application** OAuth client with `https://rumrexpenses.vercel.app` as an authorized JavaScript origin. Add each additional app origin separately if needed. An external consent screen in Testing issues refresh tokens that expire after seven days. Use an Internal audience for an eligible Google Workspace account, or publish the app for durable access.

Set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` in the production hosting environment and redeploy. Keep the secret server-side. In the app, open **Google Sheets → Connect Google account** and select the RUMR account. The app requests access to files it creates or that the user specifically grants to it. New projects get a spreadsheet. Use **Sync now** on an existing project to create its spreadsheet or retry a failed sync. The app maintains the Expenses tab, including when expenses are edited or deleted. Existing legacy sheets remain in Drive. Changing the OAuth client or secret requires reconnecting Google.
