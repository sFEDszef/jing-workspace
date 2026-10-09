# Jing Workspace

Personal study and research workspace. Courses, papers, assignments, calendar, local notes and rules-based daily priorities.

Website: https://sfedszef.github.io/jing-workspace/

## Published version

The public code excludes personal photos, real Gmail snapshots, original course files, extracted private coursework and the user's saved browser data. Course uploads remain available locally. The original local workspace was not overwritten. Course descriptions, initial assignment/paper examples and market snapshots are illustrative; they are not live external data.

Browser files and notes are stored on the current browser origin. The online site cannot automatically access files or preferences previously saved under a local `file://` page. Keep the original local page until you have transferred the files you need.

GitHub Pages is the public demo, not a password-protected deployment. The Node server now hosts the entire private workspace: unauthenticated visits redirect to `/login`, and workspace scripts/API routes are withheld until login. No DeepSeek or Gmail credentials are included. After the private site is verified, retire the old public Pages deployment.

## Ask a Question

Open **Ask a Question → AI & Gmail settings**. Enter only the root HTTPS URL of your private backend, test the connection, then log in with its private workspace password. Provider keys are never requested by the frontend.

Without a backend the assistant is explicitly labeled as local rules, not cloud AI. With the backend configured it calls `POST /api/ask`. Gmail snippets are included only after the user enables the consent setting and selects the email analysis option. Failed connections show errors instead of simulated success.

## Start the private backend

Requires Node.js 22 or newer. No third-party runtime packages are required.

1. Deploy `server.mjs` and `package.json` on a private server/service supporting persistent storage and Node.js. Start command: `npm start`.
2. Configure the environment variables listed in `.env.example` in the hosting provider's secret settings. Node does not automatically read `.env`; for local development use `node --env-file=.env server.mjs` after making your own private `.env` file.
3. On Render, leave `FRONTEND_ORIGIN` and `BACKEND_PUBLIC_URL` unset: the server uses Render's automatic `RENDER_EXTERNAL_URL`. Set `BIND_HOST=0.0.0.0`. On another host, set both URL variables to the private website's HTTPS origin. Frontend and backend should share this origin.
4. Set `WORKSPACE_PASSWORD` to a long unique password (at least 16 characters). Generate `TOKEN_ENCRYPTION_KEY` as a base64 random 32-byte value: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Keep both private.
5. Set `DEEPSEEK_API_KEY`; optionally change `DEEPSEEK_MODEL` (default `deepseek-chat`).
6. Enable Gmail API in your Google Cloud project. Create a Web Application OAuth client and configure consent/test users. Register the exact redirect URI `https://YOUR-BACKEND/auth/google/callback`. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_OWNER_EMAIL` (the one account allowed to connect).
7. Use **Connect Gmail** and complete Google's consent yourself, then **Refresh mail**. A deployment can require third-party cookies for the cross-origin private backend session; hosting frontend and backend together under one origin avoids that limitation.

OAuth refresh tokens are encrypted at rest in `.private/gmail.enc` and also sealed into an encrypted, authenticated, HttpOnly browser credential. The browser credential lets the owner restore Gmail access after a Render Free deployment or restart without repeating Google consent. It contains only the refresh token and allowed account identity; JavaScript cannot read it. Explicit **Disconnect Gmail** revokes the Google grant and clears both copies. Sessions have no application-level fixed expiry and no AI call-frequency limits. Sessions remain in memory, so a service restart can still require entering the workspace password again. Clearing browser cookies, changing the encryption key, revoking the Google grant, or Google expiring the refresh token requires authorization again. This is a single-owner backend, not a multi-user service.

## Read-only mailbox analysis

The backend requests `gmail.readonly`. It lists inbox mail from the last seven days, excludes Promotions/Spam/Trash, deduplicates by thread and processes up to 100 messages. It fetches metadata and snippets, not full bodies or attachments. Authentication-message heuristics exclude likely verification/password emails; snippets are additionally redacted. Automated redaction cannot guarantee removal of every sensitive phrase: review the consent before sending summaries to DeepSeek.

The frontend refreshes hourly while open. There is **no background daily scheduler** yet. The unread count refers to the recent snapshot, not the entire inbox. Truncated/partial snippets may omit deadlines; confirm requirements in the original email. Analysis recommends actions but never sends, replies, labels, archives or deletes mail. Disconnect revokes this app's Google grant and removes its local encrypted token.

## API contract

| Method / route | Purpose |
| --- | --- |
| `GET /api/status` | Configuration and connection status, no secrets |
| `POST /api/login` | `{password}` → HttpOnly session cookie |
| `POST /api/logout` | End current backend session |
| `GET /auth/google/start` | Begin owner-only Gmail OAuth |
| `GET /auth/google/callback` | Validate state and save encrypted grant |
| `GET /api/gmail/snapshot` | Recent filtered read-only mailbox snapshot |
| `POST /api/gmail/disconnect` | Revoke Gmail grant |
| `POST /api/ask` | `{question, context, includeGmail, consent}` → `{answer, source, model, mailCount, generatedAt}` |

All private routes require a backend session. Browser CORS allows only the configured origin. POST routes require JSON. Requests have size and timeout limits, but no AI call-frequency quota. Provider keys stay on the server; errors do not echo upstream response bodies. No mailbox context or model answers are logged or committed.

## Papers reading workspace

Papers now has a searchable PDF library, course/status filters, editable metadata, a two-column desktop reader, and mobile Original/Notes/Analysis views. PDF.js renders the actual file and selectable text. The local PDF bundles and Papers use classic scripts so the existing local `index.html` can load them without module CORS restrictions. The five upstream `import.meta.url` references are replaced by a script URL captured at load time; the worker is preloaded as before. Existing course behavior and library data are retained. Keep the complete folder together when opening the local HTML. Browser storage permissions still apply; AI requires the private backend.

Highlights store selected text, page number and normalized page rectangles, so page/zoom changes can restore their positions. Notes save on input and report failed writes. Evidence adds an interpretation, claim, course and existing assignment reference. Missing or deleted assignment references remain visible rather than being silently reassigned. Reading progress means the furthest page viewed, not comprehension or verified completion.

The canonical Papers dataset is saved in the existing IndexedDB `jingWorkspaceFilesV1` / `files` store under `papers-v2-state`; original blobs keep their existing `paper-<id>` keys. First use migrates the old Papers records and unanchored excerpts. A lightweight projection feeds the existing Dashboard. Uploads, deletes and restores commit document records and blobs in one IndexedDB transaction. Other workspace settings and Calendar records use their existing stores. Data stays on the current browser origin; switching devices/origins requires exporting and importing a Papers backup.

“Keep notes” deletion removes the PDF blob and parsed page text, retaining notes, highlights, evidence and generated versions with a deleted-source label. Full deletion also removes that paper's content from saved comparisons; a comparison with fewer than two remaining papers is removed. ZIP backup includes original files, parsed pages, reading position, annotations, notes, links, analysis histories and comparisons. Restore checks structure, sizes and SHA-256 file hashes before a single transaction, and imports as new copies without overwriting existing items. Backups contain private document content: store them privately.

The private `POST /api/papers/analyze` endpoint uses the existing server-side DeepSeek configuration and login. It requires per-request consent and sends only the selected papers' extracted page text, plus the question/selected passage where applicable. It never requests Gmail. Summary and comparison return the research question, theory, method, sample, findings and limitations. Every factual field must contain a page excerpt found in the supplied text, or say “未提及”. Invalid citations, partial/empty output and missing configuration fail explicitly. Matching an excerpt verifies its text/location, not that every AI inference is correct; users can inspect the source and edit interpretations. Regeneration preserves prior versions, including manual changes.

Limits: PDF only for new imports, 40 MB / 500 pages per file; scanned pages need OCR (not connected). Figures and tables are not visually interpreted. Publication year stays blank unless edited. AI supports up to 120,000 extracted characters across one paper or 2–5 selected papers and rejects longer input without silently truncating. Backups support up to 500 records, 200 MB of original files and a 30 MB manifest. A deployed site needs the updated frontend files **and** `server.mjs` / `papers-ai.mjs` before AI analysis can work; no deployment is performed by these changes.

Run `npm test` for backend/source-validation and existing Calendar/Mail regression tests. `npm run test:papers:browser` uses an isolated local Chrome profile, synthetic PDF fixtures generated by `tmp/papers-fixture.py`, and a deterministic mocked AI provider; it does not access real accounts or prove live DeepSeek quality. Browser assertions cover upload, real mouse text selection, reload persistence, quota errors/retry, evidence linking, deletion, ZIP restore/corruption, mobile layout and zero page errors. Fixture generation uses ReportLab; the browser runner uses the bundled Playwright path and local Chrome, configurable in the test script for another machine. Acceptance screenshots/results are under `tmp/papers-test/`.

## Existing backend verification

`npm test` checks private endpoint access, failed/missing login and provider configuration, cookie behavior, origin rejection, and removal of authentication-message snippets. A live Gmail/DeepSeek call requires your own credentials and Google authorization; those have not been performed.

Official integration references: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), [DeepSeek API](https://api-docs.deepseek.com/), [Gmail metadata listing](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/messages/list), [Google OAuth web server flow](https://developers.google.com/identity/protocols/oauth2/web-server).
