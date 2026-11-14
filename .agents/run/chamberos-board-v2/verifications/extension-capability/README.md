# Extension capability verification — installed OpenChamber

Date: 2026-11-14. Read-only inspection of the installed app in this container.
No source file was modified; the only write is this directory.

## Versions

| What | Value | Proof |
|---|---|---|
| Installed app | `@openchamber/web` **2.7.1** | `/usr/local/lib/node_modules/@openchamber/web/package.json` `"version": "2.7.1"` |
| Host version used for `engines.openchamber` | **2.7.1** (read from that same package.json at boot) | `server/index.js:295-307` (`OPENCHAMBER_VERSION`), passed at `server/index.js:2582`, `2891`, `3158` |
| Bundled SDK | `@openchamber/sdk` **2.7.1** | `@openchamber/web/package.json` dependency `"@openchamber/sdk": "2.7.1"`; installed `node_modules/@openchamber/sdk/package.json` `"version": "2.7.1"` |
| SDK purpose (its own words) | "Contract for OpenChamber guests: manifest parse and iframe host bridge." | `@openchamber/sdk/package.json` `description` |

Paths below: `SDK` = `/usr/local/lib/node_modules/@openchamber/web/node_modules/@openchamber/sdk/dist`,
`APP` = `/usr/local/lib/node_modules/@openchamber/web`.

The manifest is validated by `SDK/parse.js` (`openChamberManifestSchema`, lines 705-898) and
accepted/published by `APP/server/lib/guests/catalog.js` (`inspectGuestPackage`, line 173).

## Availability

Every point in the brief exists in 2.7.1. None is newer-only.

| Point | Available? | Proof (file:line) | Required manifest keys | Limits |
|---|---|---|---|---|
| `statusSection` | yes | `SDK/parse.js:624-634`; published `APP/server/lib/guests/catalog.js:293-303,509`; polled `APP/dist/assets/useAppFontEffects-xaAfmUwn.js:1` (minified, `qGt`/`zGt`); response `SDK/status-view-schemas.js:103-109` | `contributes.statusSection`: `true`, or object with at least one of `entry` / `source`; `source = { path, interval? }` and requires `contributes.service` (`parse.js:819-825`) | `source.path` must be a guest request path; `interval` 1000-60000 ms, default 2000 (`SDK/status-view.js:2,4,6`); `title` ≤60; `height` 24-480; `true` requires `panel.entry` (`parse.js:811-817`) |
| `statusSection.source` polling + `/status` shape | yes | `APP/dist/assets/useAppFontEffects-xaAfmUwn.js:1`: `qGt(n,s.path,s.interval,...)` -> `UGt({read:zGt(...),interval:n,...})`; `zGt` issues `GET` on `source.path` via the service request bridge and parses the body with the status view schema (`HGt` -> `Jke.safeParse`) | service answers `GET <source.path>`; body `{ rows: [...], controls?: [...] }` | 16 rows; 2 actions/row; 6 chips; 120 chart points; text 200; note 300; ids unique |
| `marks` | yes | `SDK/parse.js:659`; `APP/server/lib/guests/catalog.js:395-396`; route `APP/server/lib/guests/routes.js:371`; setter `APP/server/lib/guests/service-host-api.js:197-207`; store `marks.js` | `contributes.marks: true` **and** `contributes.service` (`parse.js:842-850`) | 200 marks per extension, 60 changes/minute (`SDK/service-host.js:32,34`); tooltip ≤200 chars, URL ≤2048 |
| `actions` | yes | `SDK/parse.js:421-434`, wired `642`; published `APP/server/lib/guests/catalog.js:339-340`; UI filters `action.where` in `APP/dist/assets/useAppFontEffects-xaAfmUwn.js:1` | `contributes.actions`: 1-8 of `{ id, label, where, icon?, mode?, roles?, payload?, display? }` | unique id (`PANEL_ID`, ≤64); label 1-40; `where` = `message\|session\|selection\|file\|diff`; `roles` only `message`; `payload:["messages"]` only `session`; `display` only `selection`; `mode` = `open\|background` |
| `commands` | yes | `SDK/parse.js:435-440`, wired `643`; published `APP/server/lib/guests/catalog.js:342-343` | `contributes.commands`: 1-8 of `{ name, description? }` | name `/^[a-z][a-z0-9-]{0,23}$/`; description 1-80; names unique |
| `mentions` | yes | `SDK/parse.js:663`; `APP/server/lib/guests/catalog.js:398-399`; routes `routes.js:351,383`; `mentions.js` | `contributes.mentions: { label }` **and** `contributes.service` | label 1-40; service search timeout 2000 ms; 20 items; title 120; text 16000 (`SDK/service-host.js:79-90`) |
| `blocks` (+ `answers`) | yes | `SDK/parse.js:544-552`, wired `664`; `APP/server/lib/guests/catalog.js:312-322`; agent text `APP/server/lib/guests/agent-context.js:32-48` (`answers` at 40) | `contributes.blocks`: 1-4 of `{ name, description, args?, entry, height?, answers? }` | name `/^[A-Z][A-Za-z0-9]{1,31}$/`, not a reserved chat component; description 1-120; ≤8 unique camelCase args; entry `.html` inside package; height 24-960; args serialized ≤16000 |
| `instructions` | yes | `SDK/parse.js:658`; `APP/server/lib/guests/catalog.js:392-393`; `APP/server/lib/guests/agent-context.js:59-74`; writer `service-host-api.js:176-181` | `contributes.instructions: true` **and** `contributes.service` | 4096 characters per write (`SDK/service-host.js:18`) |
| `skills` | yes | `SDK/parse.js:660`; folder checked `APP/server/lib/guests/catalog.js:404-409`; loaded `APP/server/lib/guests/agent-context.js:77-82`; wired `APP/server/index.js:2580` | `contributes.skills`: a folder path inside the package | must be an existing package folder; no service required |
| `sessionControl` | yes | `SDK/parse.js:657`; `APP/server/lib/guests/catalog.js:389-390`; calls `APP/server/lib/guests/service-host-api.js:116-175`; answers `86-91,159-175` | `contributes.sessionControl: { content?, answers? }` **and** `contributes.service` | `content:true` -> `transcript`; `answers:true` -> `sessionAnswers`; 60 prompts/hour (`service-host-api.js:39,106`) |
| `sessionEvents` | yes | `SDK/parse.js:648-652`; `APP/server/lib/guests/catalog.js:369-370`; delivery `APP/server/lib/guests/session-events.js:442` | `contributes.sessionEvents: { events: [...], content? }` **and** `contributes.service` | 1-8 distinct of `turn-finished, turn-failed, permission-asked, question-asked, turn-started, session-created, session-archived, session-deleted` (`SDK/session-events.js:24-27`); `content` only `true` |
| `service.schedule` | yes | `SDK/parse.js:167-173`; timers `APP/server/lib/guests/service-lifetime.js:208`, run loop `175-190` | `contributes.service.schedule`: 1-8 of `{ id, cron, timezone? }` | unique id (`PANEL_ID` ≤64); cron 5 fields, ≤64 chars, `/^[A-Za-z0-9*\/,\-?]+(?: +[A-Za-z0-9*\/,\-?]+){4}$/` (`SDK/service-host.js:52`); timezone ≤64; POST `/schedule`, wire `v:1`, 10 s timeout |
| `service.keepRunning` | yes | `SDK/parse.js:166`; `APP/server/lib/guests/service-lifetime.js:127`; idle-stop override `APP/server/lib/guests/routes.js:870` | `contributes.service.keepRunning: true` | literal `true` only |
| `service.provides` | yes | `SDK/parse.js:162-164`; roles `SDK/manifest.js:144`; each role implemented: `browser` `APP/server/lib/browser-control/provider.js:50`; `source-control` `APP/server/lib/source-control/extension-providers.js:28`; `notifications` `APP/server/lib/notifications/extension-channels.js:62`; `tracker` `APP/server/lib/trackers/extension-tracker.js:68`; `quota` `APP/server/lib/quota/extension-quota.js:49`; `opencode` `APP/server/lib/guests/opencode-provider/index.js:33` | `contributes.service.provides`: 1-6 unique of `browser\|source-control\|notifications\|tracker\|quota\|opencode` | `source-control`/`notifications`/`tracker`/`quota` must be declared together with the matching `contributes.*` block (`parse.js:729-800`); tracker and source-control are mutually exclusive; `panel.id` ≤28 for those roles |
| `integration` | yes | `SDK/parse.js:97-104`, wired `636`; `APP/server/lib/guests/catalog.js:330-331`; OAuth `APP/server/lib/guests/oauth.js`; proxy `routes.js:809`; scope `grant-scope.js` | `contributes.integration: { name, description, oauth \| token \| host (exactly one), settings? }` | `apiOrigin` https origin, no path; account `path` safe API path + `name` identifier; `scheme` `raw\|bearer\|basic`; setting id `PANEL_ID`, label 1-…, `secret:true` optional; adds `network` capability |
| `filesystem` | yes | `SDK/parse.js:638`; `APP/server/lib/guests/catalog.js:333-334`; enforcement `APP/server/lib/guests/files.js:168-170,270`; scope `grant-scope.js:197-198`; route `routes.js:904` | `contributes.filesystem`: 1-16 patterns | each ≤256 chars; absolute `/…` or `~/…`; `**` spans directories, `*`/`?` one segment; no `..`, empty segment, NUL or backslash (`SDK/manifest.js:320-332`); adds `filesystem` capability |

## Exact validation code (quoted from the installed SDK)

`SDK/parse.js:705-709` — top level:

```js
export const openChamberManifestSchema = z.object({
    apiVersion: z.literal(OPENCHAMBER_SDK_MANIFEST_API_VERSIONS[0]),
    engines: z.object({
        openchamber: z.string().trim().regex(OPENCHAMBER_ENGINE_PATTERN),
    }).strict().optional(),
    contributes: contributesSchema.superRefine((contributes, ctx) => {
```

`SDK/parse.js:613-666` — `contributes` (excerpt, all keys as validated):

```js
const contributesSchema = z.object({
    panel: panelSchema,
    ...
    statusSection: z.union([z.literal(true), z.object({
            entry: z.string().trim().refine((value) => isSafeAssetPath(value) && value.toLowerCase().endsWith('.html')).optional(),
            source: z.object({
                path: z.string().trim().refine(isGuestRequestPath),
                interval: z.number().int().min(GUEST_STATUS_SOURCE_INTERVAL_MIN).max(GUEST_STATUS_SOURCE_INTERVAL_MAX).optional(),
            }).strict().optional(),
            title: z.string().trim().min(1).max(GUEST_STATUS_SECTION_TITLE_MAX).optional(),
            height: z.number().int().min(GUEST_STATUS_SECTION_HEIGHT_MIN).max(GUEST_STATUS_SECTION_HEIGHT_MAX).optional(),
            defaultExpanded: z.boolean().optional(),
            requiresProject: z.boolean().optional(),
        }).refine((section) => section.entry !== undefined || section.source !== undefined)]).optional(),
    capabilities: z.array(z.enum(DECLARED_GUEST_CAPABILITIES)).max(8).optional(),
    integration: integrationSchema.optional(),
    service: serviceSchema.optional(),
    filesystem: z.array(z.string().max(GUEST_FILESYSTEM_PATTERN_MAX).refine(isGuestFilesystemPattern)).min(1).max(GUEST_FILESYSTEM_PATTERNS_MAX).optional(),
    ...
    sessionControl: z.object({ content: z.literal(true).optional(), answers: z.literal(true).optional() }).strict().optional(),
    instructions: z.literal(true).optional(),
    marks: z.literal(true).optional(),
    skills: z.string().trim().refine(isSafeAssetPath).optional(),
    ...
    mentions: z.object({ label: z.string().trim().min(1).max(GUEST_MENTIONS_LABEL_MAX) }).strict().optional(),
    blocks: blocksSchema.optional(),
    ...
});
```

`SDK/parse.js:544-552` — blocks, including `answers`:

```js
const blockSchema = z.object({
    name: z.string().trim().regex(GUEST_BLOCK_NAME),
    description: z.string().trim().min(1).max(GUEST_BLOCK_DESCRIPTION_MAX),
    args: z.array(z.string().trim().regex(GUEST_BLOCK_ARG_NAME)).max(GUEST_BLOCK_ARGS_MAX)
        .refine((args) => new Set(args).size === args.length, { message: 'argument names must be unique' }),
    entry: z.string().trim().refine((value) => isSafeAssetPath(value) && value.toLowerCase().endsWith('.html')),
    height: z.number().int().min(24).max(GUEST_BLOCK_HEIGHT_MAX).optional(),
    answers: z.boolean().optional(),
}).strict();
```

`SDK/parse.js:158-174` — service, including `provides`, `keepRunning`, `schedule`:

```js
const serviceSchema = z.object({
    entry: z.string().trim().refine(isSafeAssetPath),
    runtime: z.literal('host'),
    permissions: servicePermissionsSchema.optional(),
    provides: z.array(z.enum(GUEST_SERVICE_PROVIDES)).min(1).max(GUEST_SERVICE_PROVIDES.length)
        .refine((roles) => new Set(roles).size === roles.length, { message: 'provides entries must be unique' })
        .optional(),
    surface: z.literal(true).optional(),
    keepRunning: z.literal(true).optional(),
    schedule: z.array(z.object({
        id: z.string().trim().regex(PANEL_ID).max(64),
        cron: z.string().trim().refine(isServiceScheduleCron),
        timezone: z.string().trim().min(1).max(SERVICE_SCHEDULE_TIMEZONE_MAX).optional(),
    }).strict()).min(1).max(SERVICE_SCHEDULE_MAX)
        .refine((entries) => uniqueBy(entries, (entry) => entry.id), { message: 'schedule ids must be unique' })
        .optional(),
});
```

`SDK/parse.js:819-850` — cross-field requirements that matter most:

```js
        // The host reads a source from the extension's service; without one it has nothing to ask.
        if (hasStatusSource(contributes) && !contributes.service) {
            ctx.addIssue({
                code: 'custom', path: ['statusSection', 'source'],
                message: 'contributes.statusSection.source is read from the extension\'s service; declare contributes.service.',
            });
            return;
        }
        ...
        for (const key of ['sessionControl', 'instructions', 'marks', 'mentions', 'waits']) {
            if (contributes[key] !== undefined && !contributes.service) {
                ctx.addIssue({
                    code: 'custom', path: [key],
                    message: `contributes.${key} is served by the extension's service; declare contributes.service.`,
                });
                return;
            }
        }
```

`SDK/parse.js:811-817` — `statusSection: true` needs a panel page:

```js
        if (contributes.statusSection === true && !hasGuestPage(contributes)) {
            ctx.addIssue({
                code: 'custom', path: ['statusSection'],
                message: 'contributes.statusSection: true reuses panel.entry; without a panel page, name its own { "entry": "<package .html>" }.',
            });
            return;
        }
```

`SDK/parse.js:868-896` — a frame-only package (status section, file editor, block, page) can host itself, but actions/commands/attach need `panel.entry` or `background.entry`; a package with neither may only declare `tools` and `providerLogos`.

`SDK/status-view-schemas.js:103-109` — the service's `/status` body:

```js
export const guestStatusViewSchema = z.object({
    rows: z.array(rowSchema).max(GUEST_STATUS_VIEW_ROWS_MAX),
    controls: guestStatusControlsSchema.optional(),
}).strict().refine((view) => new Set(view.rows.map((row) => row.id)).size === view.rows.length, { message: 'row ids must be unique', path: ['rows'] }).refine((view) => {
    const ids = controlIds(view);
    return new Set(ids).size === ids.length;
}, { message: 'control ids must be unique across the view' });
```

The host polls it from the UI: `GET` on `source.path` at `source.interval`, reads `{ status, body }`
(`APP/server/lib/guests/service.js:876-879`), and only a 2xx with a body that parses as the schema
above renders.

## apiVersion and engines

- Accepted `apiVersion`: **1 only** — `SDK/api-version.js`: `OPENCHAMBER_SDK_MANIFEST_API_VERSIONS = [1]`; enforced by `z.literal(...)` at `parse.js:706`; failure code `unsupported-api-version` (`parse.js:961-963`).
- `engines.openchamber`: optional, but when present must match `/^(>=)?\d+\.\d+\.\d+$/` (`SDK/host-version.js:3`, `parse.js:708`). "Ranges beyond a floor are not accepted." Unknown host version fails closed (`host-version.js:39-49`).
- Install-time check: `APP/server/lib/guests/catalog.js:185-198` — a package with an engine and **no top-level `version`** fails (`!parsed.version` -> `invalid-manifest`); too-old host -> `host-too-old`.
- Repo manifest: `apiVersion: 1`, `engines.openchamber: ">=1.22.0"`, `version: "1.2.1"`.
  - Host 2.7.1 >= 1.22.0 -> **compatible**. Verified by running the installed SDK:
    `parseManifestJson` -> `ok: true`, `apiVersion: 1`, `engineOk: true` (`hostMeetsOpenChamberEngine('2.7.1','>=1.22.0')`).
  - Note: the repo's top-level `openchamber.capabilities` array is **silently dropped**; the parsed manifest's keys are `apiVersion, engines, contributes` only. `openChamberManifestSchema` is a non-strict `z.object`, so unknown top-level keys are stripped, not rejected. Only `contributes.capabilities` has effect.

## Guest check

- `bunx`: **not present** (`command -v bunx` -> exit 1; no `bun` either).
- `openchamber-guest-check`: **present as an installed binary**, not as an npm package name.
  - `APP/node_modules/.bin/openchamber-guest-check -> ../@openchamber/sdk/scripts/check-guest.ts`
  - also present in `/workspace/code/openchamber-skills/node_modules/.bin/`, `/workspace/code/openchamber-subagent-pulse/node_modules/.bin/`, `/tmp/probe/node_modules/.bin/`.
  - `npx --no-install openchamber-guest-check` fails: `npm error 404 ... 'openchamber-guest-check@*' is not in this registry.` It is a bin of `@openchamber/sdk`, not a standalone package.
- What it validates (`SDK/scripts/check-guest.ts`, 72 lines, read in full): manifest parses; every `.html` named in `contributes` exists; each page's local `<script src>` exists and is not `.ts`; the service entry exists, does not still import `@openchamber/sdk`, and reads `OPENCHAMBER_SERVICE_PORT`; provider logo files exist and are 1 byte to 1 MB. It only uses `access`, `readFile`, `stat` — no writes.
- Execution: the script's shebang is `#!/usr/bin/env bun`; Node 22.23 refuses to strip types for files under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). Ran a byte-identical copy (`cmp` confirmed) at `/tmp/opencode/guest-check/scripts/check-guest.ts` with `dist` symlinked to the installed SDK dist, against the repo root.
- Output, verbatim:

```
Package is ready to add in Settings → Extensions.
```

Exit code 0.

## Method / limits

- Every "available" row cites the validator that accepts the key and the host code that consumes it. `dist/assets/useAppFontEffects-xaAfmUwn.js` is a minified one-line bundle; its citations are line 1 and identify the function by name.
- `actions` and `commands` execution is client-side; the server-side proof is that the catalog parses and publishes them (`catalog.js:339-343`), and the UI filters by `action.where` (bundle above).
- Not run: the live app against a test package, or `openchamber --version` (would touch runtime state).
