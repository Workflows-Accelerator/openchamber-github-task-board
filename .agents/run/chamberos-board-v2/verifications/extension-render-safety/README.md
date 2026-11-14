# Extension render safety — status section and sidebar mark

Read-only proof against the **installed** OpenChamber `@openchamber/web` **2.7.1** at
`/usr/local/lib/node_modules/@openchamber/web`. No source file was edited, no secret read, no
board restart, no install. This closes the `extension-security` NOT_VERIFIED item
"host renderer source absent — renderer escaping is unproven".

**Verdict: every string in the status section and the sidebar mark is inserted as an inert React
text child or a plain attribute. There is no HTML insertion path in either renderer.** A GitHub
issue title is safe as *text* in a row `value`, a note `text`, or a mark `text` — provided it is
sliced to the schema limit first (80 / 300 / 200). The limits are enforced by parsing, not by the
renderer: an over-limit title rejects the whole view.

Assets inspected (client is minified; one logical module per line):

| asset | bytes | lines | sha256 |
|---|---|---|---|
| `dist/assets/useAppFontEffects-xaAfmUwn.js` (status section) | 3.8 MB | 1588 | `6695a780…94fd886e` |
| `dist/assets/runtimeEndpointReset-BsAAA4Nf.js` (sidebar mark) | 871 KB | 98 | `ae4347db…72223a7b` |
| `dist/assets/katex.min-2cmqKX7p.js` (schemas/constants) | 5.2 MB | 89 | `4655e19d…2aa4e80a3` |

Citations below use `file:line @byteOffset` (byte offsets are stable in these single-line bundles;
`grep -ob` reproduces them).

---

## 1. Where the status section is drawn

The section body component is `aZt` (`useAppFontEffects-xaAfmUwn.js:1584 @3843981`); its row
component is `X4e` (`@3843756`), which sends `kind:"note"` to `L7` (`@3841039`) and every other row
to `rZt` (`@3841836`). `pZt` (`@3846880`) draws the section frame and title.

Data path, end to end:

- Manifest supplies `statusSection.source.path` and the poll interval.
- `zGt` (`useAppFontEffects-xaAfmUwn.js:1584 @3827294`) builds
  `{ method:"GET", path: source.path, query:{ directory, locale } }` and calls `NB`.
- `NB` (`@3099195`) posts to the host proxy `POST /api/guests/<id>/service/request`.
- The proxy (`server/lib/guests/routes.js:852`) forwards the service response as JSON; it does not
  transform the body into HTML.
- `HGt` (`useAppFontEffects-xaAfmUwn.js:1584 @3826893`) parses and validates before any render:

```js
HGt=t=>{try{const e=Jke.safeParse(JSON.parse(t));return e.success?e.data:null}catch{return null}}
```

`Jke` is the exported schema `KJ` (`katex.min-2cmqKX7p.js:34 @5146228`), i.e.
`guestStatusViewSchema` (`{ rows, controls }`, object `.strict()`, every row schema `.strict()`). A
failed parse yields `failure:"invalid"` and the UI prints a fixed localised string
(`chat.workStatus.guestView.invalid`), never any part of the answer.

`aZt` then renders `c.rows.map(uZt)`; `uZt` is `jsx(X4e,{row:t},t.id)`.

---

## 2. Insertion method per string

All of these are React `children` (text nodes) or HTML attributes. React escapes text children; no
`dangerouslySetInnerHTML` or `innerHTML` appears anywhere in the status renderer. The only
`dangerouslySetInnerHTML` in the client chunk is `@2617376` (highlighted code lines, unrelated);
the `innerHTML` writes are the icon sprite (`@1196793`, `@1197248`), code highlighting
(`@1824098`, `@1903149`, `@1903499`) and an embedded page template (`@2462230`) — none is on the
status or mark path, and none is in the `3.70–3.85 MB` status module range.

| string | renderer call | inert / markup |
|---|---|---|
| section `title` (manifest `statusTitle`, not in the body) | `useAppFontEffects-xaAfmUwn.js:1574 @3702346` — `jsx("span",{className:…truncate…,children:s})` in `Xd` | **inert** |
| row `label` | `@3842207` — `jsx("span",{dir:"auto",tabIndex:a,className:…truncate…,children:n.label})` | **inert** |
| row `value` | `@3843225` — `jsx("span",{dir:"auto",className:"shrink-0 tabular-nums",style:…,children:n.value})` | **inert** |
| row `badge.label` | `@3843028` — `jsx(E4e,{…},children:n.badge.label)` | **inert** |
| row `content.text` | `@3836232` — `jsx("span",{dir:"auto",className:"min-w-0 flex-1 truncate",…,children:n.text})` in `XGt` | **inert** |
| row `tooltip` | `@3841688` — `jsx(jt,{…,children:n})` (`jt` = tooltip content, `@1220084`) | **inert** |
| note `text` | `@3841223` (muted) and `@3841372` (toned) — `jsx("p",{…,children:n})` in `L7` | **inert** |
| action `label` and `confirm` text | `@3837233` — `jsx("span",{dir:"auto",className:"truncate",children:C})` inside the button | **inert** |
| mark tooltip `text` | `runtimeEndpointReset-BsAAA4Nf.js:56 @405823` — formatted `"{name}: {text}"` string passed as tooltip `label` and `aria-label` (`@406111`, `@406362`) | **inert** (tooltip renders `children` at `@3841688`; `aria-label` is an attribute) |
| mark `url` click | `runtimeEndpointReset-BsAAA4Nf.js:59 @545701` — `tt.url && Rm(tt.url, Cc()??null, !0)` | **URL opened, not rendered** |

The note renderer, verbatim:

```js
L7=t=>{… r==="muted"
  ? l.jsx("p",{dir:"auto",className:"px-1 py-1 text-xs text-muted-foreground",children:n})
  : l.jsx("p",{dir:"auto",className:"mx-1 mb-1 rounded-md px-2 py-1.5 text-xs",…,children:n}) …}
```

The row label/value pair, verbatim:

```js
u=l.jsx("span",{dir:"auto",tabIndex:a,className:d,children:n.label})
…
C=n.value?l.jsx("span",{dir:"auto",className:"shrink-0 tabular-nums",style:Y4e(n.valueTone),children:n.value}):null
```

No field in the body is HTML. The schema (`KJ`) has only `rows` and `controls`; there is no
`title`, `html`, or `markdown` key, and `.strict()` rejects unknown keys.

---

## 3. Sidebar mark

`hg` (`runtimeEndpointReset-BsAAA4Nf.js:56 @405662`) renders each mark:

```js
u = r("sessions.sidebar.session.guestMark.label", { name:c.guestName, text:c.text });
… c.panel||c.url
  ? jsx("button",{ "data-guest-mark":c.guestId, "aria-label":u, onClick:d=>{…; n(c)},
        children: jsx(Ul,{mark:c}) })
  : jsx("span",{ "data-guest-mark":c.guestId, role:"img", "aria-label":u,
        children: jsx(Ul,{mark:c}) })
```

`Ul` (`@405351`) renders **only the icon**: `jsx(V,{name:bm(s.icon),className:…})`. The mark
`text` is never the mark's own label; it appears in the tooltip, the `aria-label`, and the session
hover card. The hover card `gg` (`@406592`) repeats it as
`jsx("span",{…break-words, children:t("…guestMark.label",{name,text})})`, also inert. Marks are
capped at `N5 = 2` (`@240462`).

Click target: `hg` calls `onOpen(c)`; the session-row handler is at
`runtimeEndpointReset-BsAAA4Nf.js:59 @545701`:

```js
_ = tt => { if(!tt.panel){ tt.url && Rm(tt.url, Cc()??null, !0); return }
            k.open(); Tm({ mode: lh(tt.guestId), directory:R, supported:!0 }) }
```

`Rm` is the imported export `sF` (`import{… sF as Rm …}`), and `sF` is `J5e`
(`export{… J5e as sF …}`). `J5e` (`useAppFontEffects-xaAfmUwn.js @3095808`) chooses the in-app
browser panel or falls through to `Dc`; `Dc` (`@1284582`) validates the URL and calls
`window.open(s,"_blank","noopener,noreferrer")` (`Lpe`, `@1284137`). The URL is **the service's
mark URL**: `marks.set` input schema `AE` (`katex.min-2cmqKX7p.js:34 @5146755`) requires
`url: c().trim().max(2048).refine(Jo)`, and `Jo` (`@5117058`) accepts only `https:` with no
username/password. A `javascript:` or credentialed URL is rejected at parse, so the `marks.set`
update cannot be applied. The URL is not inserted into the DOM; it is passed to a validated
opener.

---

## 4. Can a GitHub issue title go here?

An issue title is arbitrary text: quotes, `<`, `&`, newlines, 300+ chars. Per location:

| location | safe as text? | condition |
|---|---|---|
| row `value` | **yes** | slice to **≤80** characters before sending. React escapes `<`, `&`, quotes. No visual truncation: the span has `shrink-0` and no `truncate`, so a long value can wrap/overflow the 28 px row. Counts are the intended content. |
| note `text` | **yes** | slice to **≤300**. `<p>` wraps; no markup, no markdown. |
| mark `text` | **yes** | slice to **≤200** and `trim()`. Shown only in the tooltip / `aria-label` / hover card, not as sidebar text. |
| row `label`, action `label`, section `title` | inert, but **no** | these are extension-owned fixed strings (manifest/label tables); do not route issue content through them. |

Failure mode is not injection, it is rejection: `value` >80, note >300, or mark `text` >200 makes
`Jke.safeParse` fail, the whole section renders the fixed "invalid" error, and the mark update
cannot validate. So the service must truncate (ideally with an ellipsis) before sending, not rely
on the renderer.

---

## 5. Length and newline behaviour

Schema limits (`katex.min-2cmqKX7p.js:34`): label `Rw=60` (`@5143463`), value `cc=80` (`@5143475`),
content/tooltip `oD=200` (`@5110895`), note `iD=300` (`@5110902`), rows `XO=16` (`@5110862`),
mark text `FN=200` (`@5116390`), mark URL `EN=2048` (`@5116397`).

- **Truncation:** `truncate` (Tailwind: `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`)
  is on the row label, content text, action label, and section title. The tooltip wraps instead
  (`max-w-[min(320px,calc(100vw-24px))] whitespace-normal break-words`). The note `<p>` wraps.
  The row **value has no truncate** and is `shrink-0`; an 80-character value can overflow or wrap
  inside the fixed `h-7` row. Keep values short.
- **Newlines:** no `whitespace-pre*` class appears in any of these paths. Default CSS collapses
  `\n` to a space, and `truncate` is `nowrap`. A newline therefore cannot create a second row,
  break the row grid, or inject a line; a multi-line title is displayed as one line.
- **300+ characters:** cannot be shown anywhere as-is. `value` must be ≤80, note ≤300, mark text
  ≤200. Slice in the service.

---

## 6. Residual risk and the rule

Residual risk: this proof is tied to **2.7.1** and the three asset hashes above. The client is
minified and the renderer is a React function component; a future version could change a field to
`dangerouslySetInnerHTML`, to a markdown renderer, or add an HTML-bearing field. The bundle already
contains `dangerouslySetInnerHTML` for code highlighting, so the primitive is present in the
codebase even though it is not used here. `dir="auto"` also allows bidi control characters to
reorder the *display* of a title (not markup, but a spoofing surface).

**Rule for the implementation (one line):** send an issue title only as plain text in `value`
(≤80), note `text` (≤300), or mark `text` (≤200); never send HTML or markdown, and never assume a
future renderer will sanitise it — escape/slice at the service so the answer is safe under either
renderer.

A concrete belt-and-braces variant: replace `<`/`>`/`&` with their text forms or strip them, and
collapse newlines to spaces, before slicing. That is redundant today and costs nothing.

---

## 7. Method and limits

- Read-only; only this directory was written. No source edit, no secrets, no restart, no install.
- Reproduce with `grep -ob '<snippet>' /usr/local/lib/node_modules/@openchamber/web/dist/assets/<asset>`.
- **NOT VERIFIED:** no browser/DOM execution. The conclusion is from the compiled renderer code
  (React `children` insertion) and the strict schema, not from a live DOM assertion. A runtime
  assertion remains the stronger proof if the implementation wants one; it is not required to
  decide that an issue title may be shown as text.
- **NOT VERIFIED:** other client entry points were not exhaustively audited. The mobile chunk
  `renderMobileApp-B_PjVgBu.js:125850` reimplements the mark as
  `jsx("span",{"data-guest-mark":…,role:"img","aria-label":u,onClick:…})` with the same inert
  `aria-label` pattern, but only the two main chunks were read in full. Desktop shell wrappers
  were not inspected.
