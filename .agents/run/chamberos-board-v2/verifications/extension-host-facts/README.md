# Extension host facts — installed OpenChamber 2.7.1

Status: READ-ONLY fact-finding. No source file edited, no service restarted, no
secret read. Answers come from the installed host code, not from `API.md`.

Read:

- Installed app `/usr/local/lib/node_modules/@openchamber/web` (2.7.1):
  `server/lib/guests/*`, `dist/assets/*`.
- SDK `node_modules/@openchamber/sdk` in this repo. `md5sum` of `parse.js`,
  `status-view.js`, `status-view-schemas.js`, `service-host.js` is identical to
  the app's bundled copy `node_modules/@openchamber/sdk/dist`, so the repo SDK is
  the installed contract.
- Two `node --input-type=module -e` probes against that SDK (no files written),
  results quoted in §3.

Bundle offsets are byte offsets into the named file under
`/usr/local/lib/node_modules/@openchamber/web/dist/assets/`.

## 1. Answers

| Question | Answer | Proof | Consequence for implementation |
|---|---|---|---|
| 1. What does the status poll send? | Two hops. Browser → host: `POST /api/guests/<guestId>/service/request`, header `Content-Type: application/json`, body `{"method":"GET","path":"/status","query":{"directory":"<abs dir>","locale":"<tag>"}}` (no `body` key). Host → service: `GET http://127.0.0.1:<port>/status?directory=<enc>&locale=<enc>`, headers `accept: application/json` and `authorization: Bearer <service token>`; no request body. No `Accept-Language`, no session id, no window id, no viewer id on either hop. | `useAppFontEffects-xaAfmUwn.js:3826780` (`G4e` query builder), `:3829604` (`qGt` poll hook), `:3099195` (`NB` POST), `:3827294` (`zGt` GET descriptor); `server/lib/guests/routes.js:852-877`; `server/lib/guests/service.js:787-812`; `server/lib/guests/service.js:34` (`authorization`) | Parse `req.query.directory` and `req.query.locale`; verify the bearer equals `OPENCHAMBER_SERVICE_TOKEN`; treat `directory` as untrusted input even though only the host calls the service. 5000 ms is inside 1000–60000. |
| 2. Directory scoping | The poll carries the project directory, as `?directory=<exact folder>`, when the section is rendered with one; `locale` is always sent. Nothing else about the project is exposed: no project id, session id, window id or viewer id. The section can be per-project: `requiresProject: true` hides it (`return null`) when no directory exists. | `G4e`: `(t,{directory:e,locale:n},s)=>({...s,path:t,query:e?{directory:e,locale:n}:{locale:n}})`; `useAppFontEffects-xaAfmUwn.js:3847189` `const d=!n.statusRequiresProject||!!s;` then `if(!d)return null;`; section rendered with the session directory at `:3850769` (`pZt,{guest:A,directory:s}`) | Declare `requiresProject: true` and exact-match the query directory against the board's own root before answering. Without a directory the request has no `directory` param, so answer the empty state, never an All-Projects count. |
| 3. Row action click | `POST <source.path>?directory=<dir>&locale=<tag>` with JSON body `{"id":"<action id>"}` (button), `{"id":"…","value":"on"\|"off"}` (switch) or `{"id":"…","value":"…"}` (select/segmented). It carries both directory and locale, in the query. It can only reach the service: the action schema has no url, panel or session field, and no action id is special-cased. Chips are the only click-through that opens a URL. | `useAppFontEffects-xaAfmUwn.js:3843981` `VGt(n,s.path,{directory:r,locale:a},N)`; `:3826991` `VGt` (POST) ; `:3836389` (`eZt` button, inline two-click `confirm`); `:3835556` (`XGt` content switch); `status-view-schemas.js:58-75` (action union); `status-view.d.ts:126-129` (`{id, value?}`) | Validate `id` and `value` in the service; an unknown id must be a no-op. Do not plan an "Open board" row action — it cannot open the panel. Use a `chips` entry with an `http(s)` url for click-through. |
| 4. `sessions.status` and `sessionControl` | **Yes, it requires `sessionControl`.** The host refuses with 403 `NOT_GRANTED` unless `capabilityGrants` includes `sessionControl`, i.e. the manifest must declare `contributes.sessionControl`. Return shape `{ status: 'idle' \| 'busy' \| 'waiting' }`; `waiting` = only the user can move it on. No `sessionControl.content` needed (that is `lastReply`). | `server/lib/guests/service-host-api.js:140-145` (`needs(guest,'sessionControl')`, `{status: sessionStatus?.type ?? 'idle'}`); `:78-80` (`needs`); `server/lib/openchamber-control/service.js:572-575`; `service-host.d.ts:128-131`; `GUEST_SERVICES.md:197` | The approval dialog gains `sessionControl`: "Start sessions and send messages" (`settings.extensions.capability.sessionControl`). That is a heavy permission for a read-only count. Either accept it, or derive "running" from `sessionEvents` activity and skip `sessions.status` entirely. |
| 5. `statusSection` keys | Honored: `entry`, `source.path`, `source.interval`, `title`, `height`, `defaultExpanded`, `requiresProject`. Unknown keys at section level are silently stripped (parse still passes); keys inside `source` are strict and reject the manifest. Row `content` kinds `bar`, `chart`, `chips`, `text`, `segmented` are all rendered. `content.chips[].url` must be `http(s)`, ≤2000 chars, and is rendered as a clickable chip that opens the URL (browser panel when available, else system browser). | `parse.js:624-634`; `parse.js:613-666` (non-strict `contributes`); `manifest.js:463-468`; `catalog.js:293-299,509-514`; `useAppFontEffects-xaAfmUwn.js:3847728` (`statusTitle ?? name`), `:3847189`, `:3835556` (`XGt`), `:3833299` (`YGt` chip → `openUrl`), `:3095808` (`J5e` open URL); `status-view-schemas.js:30-34,103-113` | Keep `title`, `height`, `defaultExpanded`, `requiresProject`; typo'd keys vanish without error, so test the rendered result, not the parse. Build rows exactly: row/content/action objects are strict, so one stray key invalidates the whole answer. |
| 6. `setMark` localization | The host does **not** localize mark text. It stores `text` verbatim and shows it inside a localized template: English `"{name}: {text}"`, where `name` is the extension's name. One string is shown as-is in every language. | `server/lib/guests/marks.js:9` (`sameMark` compares `text` verbatim); `runtimeEndpointReset-BsAAA4Nf.js:239823` (`text:m.text`), `:405823` and `:406961` (`t("sessions.sidebar.session.guestMark.label",{name:c.guestName,text:c.text})`); `katex.min-2cmqKX7p.js:794213` (en `"{name}: {text}"`) | A mark cannot follow the viewer's UI language (no locale is passed to `marks.set`). Use a language-neutral or English text, or put the count in the icon/tone and keep the text short. |

## 2. Verbatim code

Query builder and both hops (client):

```js
// useAppFontEffects-xaAfmUwn.js:3826780
G4e=(t,{directory:e,locale:n},s)=>({...s,path:t,query:e?{directory:e,locale:n}:{locale:n}})
// :3826991  action
VGt=async(t,e,n,s)=>{const r=await NB(t,G4e(e,n,{method:"POST",body:JSON.stringify(s)}));...
// :3827294  read
zGt=(t,e,n,s=NB)=>{...const c=await s(t,G4e(e,n,{method:"GET"}));...
// :3099195  browser -> host
NB=async(t,e,n)=>{try{const s=await ct(`/api/guests/${t}/service/request`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n?{...e,viewerId:n}:e)});...
```

Host → service URL and headers:

```js
// server/lib/guests/service.js:789
url = new URL(requestPath, `http://127.0.0.1:${runtime.port}/`);
// :796
if (query) { for (const [key, value] of Object.entries(query)) { url.searchParams.set(key, value); } }
// :803
const headers = { ...extraHeaders, Accept: accept, [OPENCHAMBER_SERVICE_AUTH_HEADER]: `Bearer ${runtime.token}` };
// :34
const OPENCHAMBER_SERVICE_AUTH_HEADER = 'authorization';
```

`sessions.status` gate and shape:

```js
// server/lib/guests/service-host-api.js:140
case 'sessions.status': {
  const refused = needs(guest, 'sessionControl');
  if (refused) return refused;
  const { sessionStatus } = await readSession(control, 'session.status', input);
  return ok({ status: sessionStatus?.type ?? 'idle' });
}
// server/lib/openchamber-control/service.js:572
const asPublicStatus = async (statuses, sessionID) => {
  if (!statuses[sessionID]) return { type: 'idle' };
  return await isWaitingForUser(sessionID) ? { type: 'waiting' } : { type: 'busy' };
};
```

Section schema (non-strict object, strict `source`):

```js
// parse.js:624
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
```

Row visibility and polling lifetime:

```js
// useAppFontEffects-xaAfmUwn.js:3847189
const c=ve(a),d=!n.statusRequiresProject||!!s;Kl(i,d); ... if(!d)return null;
// :3700507  collapsible: children render only while expanded (S); `p` is the section body
$=w?S?l.jsx(T_,{children:p}):f?l.jsx(T_,{children:f}):null:S?p:f
// :3829604  scheduler: next read only after the previous one answered, and never while hidden
d=()=>{const h=UGt({read:zGt(t,e,{directory:s,locale:r}),interval:n,onRead:...})}
```

## 3. Probe results

`node --input-type=module -e` importing `parse.js` and `schemas.js` from the
repo SDK (identical to the installed copy):

- Manifest with `source:{path:'/status',interval:5000}`, `title`, `height:160`,
  `defaultExpanded:false`, `requiresProject:true`, plus unknown section keys
  `default_expanded` and `wat` → `ok true`, and the parsed section is exactly
  `{"source":{"path":"/status","interval":5000},"title":"Board","height":160,"defaultExpanded":false,"requiresProject":true}`.
  So section-level unknown keys are stripped, and all five named keys survive.
- `source:{path:'/status',bogus:1}` → `ok false`, `invalid-status-section`.
  `source` is strict.
- `source:{path:'/status',interval:500}` → `ok false` (range 1000–60000).
- `guestStatusViewSchema` with a row carrying one extra key → `ok false`,
  `unrecognized_keys: ["bogus"]`. Rows are strict.
- Chip `url:"javascript:alert(1)"` → `ok false`, `chip url must be http(s)`.
- Three `actions` on one row → `ok false` (max 2).

## 4. Consequences for implementation

1. Section is per-project, not All Projects: declare `requiresProject: true`,
   exact-match `?directory=` against the board root, and answer the empty state
   when the parameter is absent. The host forwards the value unvalidated.
2. `sessions.status` costs `contributes.sessionControl` and the approval line
   "Start sessions and send messages". If that is unacceptable, take the
   running count from `sessionEvents` activity instead.
3. The status view is strict and all-or-nothing: one extra key, a third action,
   a seventh chip or a non-`http(s)` url makes the whole section show an error.
   The poll runs only while a human has the section mounted and expanded in a
   visible tab, so it is a view refresh, not a background tick.
4. Mark text is one string for every locale; only the `{name}: {text}` wrapper
   is translated.

## 5. Not verified

- The app's shared browser fetch wrapper (`ct`) may add headers beyond the
  `Content-Type` the guest module sets; only the guest module's explicit header
  and the host → service headers were read. No `Accept-Language`, session id or
  window id appears in the guest module's body.
- Whether the phone build renders source-backed sections: the mobile entry
  (`mobile-BFQ0eaJT.js`) and `renderMobileApp-*.js` contain no `statusSource`
  or `statusTitle` reference, but the mobile entry lazy-loads the shared chunk
  that does. Not exercised on a device.
- Live HTTP behaviour: nothing was run against the board or the extension
  service; all claims are static code reads plus the two SDK probes.
