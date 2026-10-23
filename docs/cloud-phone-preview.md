# Private cloud preview on your phone

Status: deployment preparation, not a running hosted environment. This uses one
Render Node web service for the Expo browser build and existing API, with an
already-provisioned PostgreSQL test database. It does not change native Expo Go
builds or deploy a new database automatically.

## Connect Render

1. Open https://dashboard.render.com and choose New > Blueprint.
2. Connect dstancomb3/DND-Companion, branch main, using render.yaml at the root.
3. Review the proposed service and provider limits before creating it. The recipe
   requests the free web-service plan; it may sleep or have resource/build limits.
   No database or paid service is created by this file.
4. Enter DATABASE_URL for an already-provisioned TEST database and a random
   PREVIEW_PASSWORD of at least 20 characters. Do not paste either into chat,
   a GitHub issue or an EXPO_PUBLIC variable. Username defaults to tester.
   Render generates PREVIEW_SESSION_SECRET; keep it private and at least 32
   characters if overriding it. Render supplies PORT and RENDER_EXTERNAL_URL.
5. Deploy and open the service's HTTPS URL in Chrome on the phone. Sign in using
   tester and the preview password. This is the app itself, not an Expo Go page.

Schema provisioning is a prerequisite, not a build/start step. Verify the test DB
has party_sessions, party_members and party_runtime_snapshots, existing nullable
host_token_hash/member_token_hash columns, campaign_continuation_snapshots with
bigint client_saved_at, and ai_idempotency_records. Follow the existing
[migration notes](migrations.md), [host](party-host-permissions.md) and
[member](party-member-permissions.md) rollout instructions. Do not run force
schema push against a database with data. The blueprint runs no migrations.
The public /healthz route checks the process only, not database/schema readiness.

The Render Blueprint import validates the recipe in your account. Provider
creation, GitHub connection, actual resource availability and hosted acceptance
have not been exercised by the repository tests.

## Optional AI configuration

The app can load without AI credentials; AI actions will report configuration
errors until supplied. Add these private server variables in Render when ready:

| Variable | Purpose |
| --- | --- |
| AI_INTEGRATIONS_OPENAI_API_KEY | Provider credential valid outside Replit |
| AI_INTEGRATIONS_OPENAI_BASE_URL | Provider's compatible API base URL |
| OPENAI_MODEL / OPENAI_VISION_MODEL | Optional existing model overrides; use models your provider supports |

Do not assume an old Replit-only proxy address or credential works on Render.
Existing model selection and AI route behavior are unchanged. The preview login
limits access to this test instance; it does not implement per-user AI quotas,
provider spending limits or the complete O05 authorization backlog.

## How protection works

The start:preview entry point always forces CLOUD_PREVIEW_MODE=true, even if a
service variable is accidentally unset or false. The recipe also sets it explicitly. Missing/weak secrets, invalid
HTTPS origin, invalid mode or missing web output fail startup. The password gate
covers HTML, assets and API before request-body parsing or route handlers.
Successful browser Basic login issues a signed eight-hour HttpOnly/Secure/
SameSite=Strict cookie. The cookie is separate from Authorization so member/host
Bearer credentials still reach party routes unchanged. Changing the password or
session secret invalidates preview cookies; reload and sign in after expiration.
A browser may retain Basic credentials until its session is closed, so use a
private/incognito window when testing on a shared device.

The web app calls its own HTTPS origin. Preview API calls from another browser
origin are refused; CORS is not enabled in this mode. All testers use this same
site and password. Native clients pointed at this protected endpoint do not have
a preview-cookie login flow in this pass. Normal local/native dev is unchanged
when preview mode is disabled. Never disable the gate on a public test instance
merely to make a native request succeed.

The only unauthenticated endpoint added is /healthz, returning a minimal process
status. Unknown /api paths return JSON 404 and do not become SPA HTML. Browser
deep links return index.html; missing assets and hidden paths do not.

## Build and check locally

From the repo root, with dependencies already installed:

```powershell
pnpm run build:preview
pnpm run test:cloud-preview
pnpm run test:preview-build
```

The build wrapper forces EXPO_PUBLIC_API_SAME_ORIGIN=true and EXPO_NO_DOTENV=1,
exports a browser SPA, and bundles the API. Secrets must remain runtime/server
variables; never place them in EXPO_PUBLIC values. The compiled HTTP smoke uses
only temporary local credentials and an unreachable local DB URL, without
successful DB or AI calls. It verifies startup, login, JS delivery, deep links,
API protection and compatibility of preview cookies with party Bearer headers.
It does not test a real phone browser or real database.

Render pins Node 20.20.2 and pnpm 10.33.0. Local agent validation used Linux,
Node 24.19.0 and pnpm 11.25.0, so provider/runtime acceptance remains required.

## Updates after setup

The blueprint follows main and explicitly enables automatic deployment on each
commit. Once connected, merging an update triggers Render to rebuild the browser
app and restart the service. Wait for deployment to finish, then refresh the same
HTTPS URL on your PC and phone. You do not need to rebuild or relaunch the app on
your laptop for these browser tests.

This is deployment, not instant development hot reload. Each update still needs
a cloud build; check its status before testing. Local/native Expo testing remains
a separate workflow.

## Phone acceptance

- Use the same hostname each time. Browser character data and host/member
  credentials do not automatically move from your laptop to your phone or to a
  new hostname. Import an exported character JSON and create a fresh party from
  the device intended to host it. Clearing browser data loses those credentials.
- Check landing page, character creation/import, item editing and deep-link reload.
- Test a host and player in separate browser profiles/devices, including party
  gates, notes, loot, combat turns and companion reuse. Only one browser/device
  holding the original host proof can perform host controls.
- Restart/redeploy the service and check DB-backed party/campaign state. Do not
  infer persistence from /healthz or an in-process save acknowledgement alone.
- Test AI only after private provider credentials are configured. Keep the preview
  password private and rotate it when the testing group changes.

## Rollback and current limits

Disable or delete the hosted service to stop testing; reverting repository code
alone does not shut down a cloud resource. Keep the existing database and
capability columns. Do not leave an older unprotected API publicly accessible
when rolling back. This is an opt-in shared staging perimeter, not account login,
a production security release, a PWA/offline implementation or full data sync.

Export and compiled HTTP tests pass. Browser visual QA is still pending: the
agent's Chromium download failed with a truncated archive. Actual Render HTTPS,
phone login/cookie behavior, cold starts, database/AI connectivity, UI rendering
and multi-device acceptance remain operator checks.

References checked during preparation:
- https://render.com/docs/blueprint-spec
- https://render.com/docs/environment-variables
- https://render.com/docs/infrastructure-as-code
- https://docs.expo.dev/guides/publishing-websites/
- https://docs.expo.dev/guides/environment-variables/


## Startup memory failure follow-up (DEP02)

The first hosted attempt exported the web app and bundled API successfully, but
the deployment reported exceeding 512 MiB. Its startup log also showed Corepack
fetching pnpm 12.15.0 and dependency downloads near port scans. This does not
establish that the API itself needs more than 512 MiB.

The service now starts the protected wrapper directly with Node, bypassing
Corepack/pnpm at runtime. The root packageManager field pins pnpm 10.33.0 for
build tooling. Build dependencies are still installed only by the build command;
the start wrapper never installs or builds anything.

After Blueprint sync, verify Settings → Start Command is exactly:
node --enable-source-maps scripts/start-cloud-preview.cjs
Then inspect the new deployment logs. If memory failure persists, capture runtime
logs/metrics before changing instance size. This change removes an observed
startup tool-version problem; it is not proof of hosted memory acceptance.
