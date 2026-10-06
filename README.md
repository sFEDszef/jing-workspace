# Jing Workspace

Personal study and research workspace. Courses, papers, assignments, calendar, local notes and rules-based daily priorities.

Website: https://sfedszef.github.io/jing-workspace/

## Published version

The public code excludes personal photos, real Gmail snapshots, original course files, extracted private coursework and the user's saved browser data. Course uploads remain available locally. The original local workspace was not overwritten. Course descriptions, initial assignment/paper examples and market snapshots are illustrative; they are not live external data.

Browser files and notes are stored on the current browser origin. The online site cannot automatically access files or preferences previously saved under a local `file://` page. Keep the original local page until you have transferred the files you need.

GitHub Pages deploys the static frontend from `main` / root. The backend source is provided for later deployment; GitHub Pages does not execute it. No DeepSeek or Gmail credentials are included.

## Ask a Question

Open **Ask a Question → AI & Gmail settings**. Enter only the root HTTPS URL of your private backend, test the connection, then log in with its private workspace password. Provider keys are never requested by the frontend.

Without a backend the assistant is explicitly labeled as local rules, not cloud AI. With the backend configured it calls `POST /api/ask`. Gmail snippets are included only after the user enables the consent setting and selects the email analysis option. Failed connections show errors instead of simulated success.

## Start the private backend

Requires Node.js 22 or newer. No third-party runtime packages are required.

1. Deploy `server.mjs` and `package.json` on a private server/service supporting persistent storage and Node.js. Start command: `npm start`.
2. Configure the environment variables listed in `.env.example` in the hosting provider's secret settings. Node does not automatically read `.env`; for local development use `node --env-file=.env server.mjs` after making your own private `.env` file.
3. Set `FRONTEND_ORIGIN=https://sfedszef.github.io` (origin only, no repository path). Set `BACKEND_PUBLIC_URL` to the public HTTPS backend URL. Set `BIND_HOST=0.0.0.0` on managed hosting.
4. Set `WORKSPACE_PASSWORD` to a long unique password (at least 16 characters). Generate `TOKEN_ENCRYPTION_KEY` as a base64 random 32-byte value: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Keep both private.
5. Set `DEEPSEEK_API_KEY`; optionally change `DEEPSEEK_MODEL` (default `deepseek-chat`).
6. Enable Gmail API in your Google Cloud project. Create a Web Application OAuth client and configure consent/test users. Register the exact redirect URI `https://YOUR-BACKEND/auth/google/callback`. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_OWNER_EMAIL` (the one account allowed to connect).
7. Use **Connect Gmail** and complete Google's consent yourself, then **Refresh mail**. A deployment can require third-party cookies for the cross-origin private backend session; hosting frontend and backend together under one origin avoids that limitation.

OAuth refresh tokens are encrypted at rest in `.private/gmail.enc`; mount persistent private storage there. Sessions are in memory and expire after eight hours; a restart requires signing in again. Use HTTPS, a reverse proxy and network rate limiting for any internet-facing backend. This is a single-owner backend, not a multi-user service.

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

All private routes require a backend session. Browser CORS allows only the configured origin. POST routes require JSON. Requests have size, frequency and timeout limits. Provider keys stay on the server; errors do not echo upstream response bodies. No mailbox context or model answers are logged or committed.

## Verification

`npm test` checks private endpoint access, failed/missing login and provider configuration, cookie behavior, origin rejection, and removal of authentication-message snippets. A live Gmail/DeepSeek call requires your own credentials and Google authorization; those have not been performed.

Official integration references: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), [DeepSeek API](https://api-docs.deepseek.com/), [Gmail metadata listing](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/messages/list), [Google OAuth web server flow](https://developers.google.com/identity/protocols/oauth2/web-server).
