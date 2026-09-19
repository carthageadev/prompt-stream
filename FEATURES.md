# prompt/studio — feature inventory

This documents the app **as built in this repo** (Next.js 16 App Router + PostgreSQL/Drizzle),
mapped against the original `prompts.achraf.tn` FastAPI implementation. Everything listed under
"Ported" exists in code; everything under "Changed" is a deliberate redesign decision.

---

## 1. Architecture

| Layer | Original | This repo |
| --- | --- | --- |
| UI | React + Vite SPA | Next.js App Router (server pages + client islands) |
| API | FastAPI, in-memory rate limit, auto-created tables | Route handlers in `src/app/api/*`, Drizzle ORM, `npx drizzle-kit push` |
| DB | SQLite / auto-seed | PostgreSQL (`stacks`, `prompts`, `tag_colors`, `compositions`, `composition_items`, `insight_cache`) |
| AI | provider + heuristic fallback | `src/lib/ai.ts` (OpenAI, optional) + `src/lib/insights.ts` (deterministic fallback) |
| Dead code | `BuildStream`, `LiveCompiler`, `PromptBlock`, `BlockLibrary`, `LibraryManager`, `LibraryOverlay` | not ported |

### API surface

| Route | Purpose |
| --- | --- |
| `GET /api/health` | liveness + db probe (used by the platform healthcheck) |
| `GET/POST /api/prompts` | list (`?archived=1`, `?stackId=`) / create (auto-tag aware) |
| `GET/PATCH/DELETE /api/prompts/:id` | read with lineage, partial update, archive (`DELETE`) vs purge (`?hard=1`) |
| `POST /api/prompts/:id/fork` | fork with `parentPromptId` / `rootPromptId` |
| `GET/POST/DELETE /api/stacks`, `PATCH/DELETE /api/stacks/:id` | stack CRUD, slug minting, publish toggle |
| `GET/PUT/DELETE /api/tag-colors` | tag colour registry |
| `POST /api/search/semantic` | ranked semantic search over the whole library |
| `POST /api/insights/{tags,quality,related}` | insights, cached by content hash |
| `POST /api/optimize` | sharpen a block (AI when keyed, heuristic otherwise) |
| `GET/POST /api/compositions`, `GET/PATCH/DELETE /api/compositions/:id` | composition recipes |

All handlers share `src/lib/http.ts`: fixed-window **rate limiting (100 req/min/IP)**, CORS headers
on every response, and JSON body parsing that never throws.

---

## 2. Ported features

### A. Prompt library
- Six block types: `persona`, `context`, `constraint`, `format`, `instruction`, `example`.
- **Responsive masonry grid, 1–5 columns**, persisted to `localStorage` (`ps.columns`).
- Card shows: type glyph, tag chips, stack badge, `#order` badge, fork badge, and (in semantic
  mode) the match reason.
- Per-card **copy** with check-flash, per-card **mount to rack** (`+` / `−`).
- **Quick Creator** modal — paste big text, `⌘/Ctrl+Enter` saves, `Esc` closes.
- **Global paste-to-create** — paste anywhere outside an input and it becomes a block.
- **Empty state** ("Canvas Empty") with shortcut hint.
- **Editor overlay** — title, content, type, stack, order, tags, fork, lineage, AI tools.
- **Optimistic UI** — the card renders instantly with a temp negative id, then swaps in the row.

### B. Stacks & Groups
- Create, **rename via double-click**, delete stacks (blocks are detached, never destroyed).
- **Groups** (stored as baskets) link cards loosely. Two views, persisted as `ps.group-view`:
  - **Flow (default):** every card in one natural masonry. Grouped cards carry a small ledger line
    (colour dot + group name) and a tinted outline, so same-group cards read as linked wherever
    they land — the S/L shapes emerge from position, never from boxes. Collapsed groups lift out
    into a slim "tucked away" strip above the grid.
  - **Groups (strict):** each group renders as a coloured outline envelope around its cards, with
    an ungrouped section below. Envelope columns clamp to the visible card count so small groups
    never leave half the box empty.
- Organize mode supports multi-select, select-visible, create group from selection, bulk move, and ungroup.
- Group collapse state persists locally; rename is inline; deleting a group safely returns its prompts to Ungrouped.
- A prompt can also be assigned precisely from its editor. `⌘/Ctrl+G` toggles organize mode.
- Language rule: **tags** carry meaning, **groups** carry membership. Nothing else on the card does either job.
- `all` / `unassigned` / per-stack / `archives` tabs.
- **Four per-stack themes** — Midnight Grid, Signal Sunset, Oxide Paper, Sea Glass — applied via a
  `data-stack-theme` attribute that re-maps `--accent`, `--accent-2`, `--tint-a`, `--tint-b`.
- **Stack settings overlay**: name, public slug, description, cover image, theme picker, publish.
- **Public stack pages** at `/s/<slug>` — themed, cover image, copy-link, per-prompt copy.

### C. Rack / Mixer
- Slide-in panel, mount/unmount from the grid.
- **Drag-to-reorder** (HTML5 drag events) **plus keyboard ↑/↓ reorder**.
- **Stub nodes** — textareas that live only in the rack, never persisted.
- **Live preview buffer** + char count.
- **Commit Signal** copies the combined prompt; result modal offers **Copy** and **Create Note**
  (which saves the result back into the library).

### D. Search & filtering
- **Keyword mode**: substring match over title, content and tags.
- **Semantic mode**: `POST /api/search/semantic`, debounced ~280 ms, ranked hits with reasons.
- Mode toggle in the header; automatic fallback to keyword if the request fails.
- **Tag filter bar**: multi-select, ANY semantics, horizontal scroll, edge fades + arrows, reset.

### E. Tags
- **Auto-tagging** (toggleable): Python, JS/TS, React, Next.js, C#/Unity, C++/Unreal, SQL, Rust and
  core categories (Role, Context, Rules, Output, Code, Logic, Tone, Data, Review, Writing, Security).
- Language detection implies `Code`; `TypeScript` collapses `JavaScript`; `Unity` implies `C#`.
- **Custom tag colours**: built-in palette for known tags, **golden-angle hue** for unknown tags so
  colours stay visually separated.
- **Colour uniqueness enforcement** — hues within 12° of an in-use colour are disabled.
- **Hue + lightness sliders** with live gradient tracks, swatch grid, and "Reset to Default".

### F. AI / intelligence (editor overlay)
- **Suggest tags** — addable suggestions plus **merge suggestions** (source → target).
- **Analyze quality** — 6-metric scorecard with animated bars: Clarity, Specificity, Constraints,
  Output, Reuse, Ambiguity control + summary + recommendations.
- **Find related** — similarity across the library with score and reason.
- **Fork prompt** — child block carries lineage; **lineage panel** lists ancestors/descendants and
  jumps between them.
- Insights are **cached by content hash** in `insight_cache`, and fall back to a deterministic
  heuristic profile when no AI key is present (`source: "ai" | "heuristic"`).

### G. Composition Studio (`/compose`, `/compose/:id`)
- Three panes: **library palette** (searchable), **composition canvas**, **export preview**.
- Blocks or inline items, each assigned a section: Role / Context / Rules / Examples / Output / Freeform.
- Reorder, edit, delete, per-item label, debounced autosave with a saving/saved badge.
- **Export presets**: ChatGPT (markdown sections), Claude (XML tags), Gemini (parts),
  **OpenRouter JSON** (a real `messages` array), one-click copy.

### H. Sessions (`/sessions`)
- List + editor, **stored locally only** — nothing reaches the server.
- **Autosave** (~400 ms) with a live saving/saved indicator and derived titles.
- **Image attachments**: upload, paste screenshots, drag-and-drop anywhere; copy image to clipboard,
  download, remove, expandable attachments panel.
- **Insert prompt** embeds a library block snapshot into the body.
- `⌘/Ctrl+K` focuses search, `⌘/Ctrl+Enter` creates a session.
- **Quota handling** — a friendly banner when local storage fills up.

### I. Appearance
- Dark / light theme, rounded / sharp corners, column count, auto-tagging — all persisted and
  bootstrapped pre-paint by an inline script (no theme flash).

---

## 3. The dynamic card / search UX (unchanged in spirit)

The grid is a **persistent list that animates visibility**, not a re-render per filter.

- Every block stays in the DOM. Filtering computes `visibleIds: Set<number>` in a `useMemo`.
- A card toggles between:
  - shown → `opacity-100 scale-100 max-h-[900px] p-4 mb-4`
  - hidden → `opacity-0 scale-90 max-h-0 mb-0 border-0 translate-y-4 pointer-events-none`
- `transition-all duration-500 ease-in-out` makes cards fade + scale + collapse their height while
  the masonry (`column-count`) re-flows around them. Cards are never re-parented, so transitions
  are never interrupted.
- **New cards flash** (`animate-flash-border`, ~2 s).
- **Deleting cards collapse out** (~400 ms) before leaving the list.

### The undo pattern
- Archive → collapse → info toast "Prompt moved to archives" with a **Revert** action for 6 s.
- The API call is **deferred 6 s**; revert cancels the timer and re-animates the card back in.
- Toasts with actions live 6 s, plain toasts 3 s.
- `archives` is a real view now: restore or permanently delete any archived block.

### Type-to-search
- A global `keydown` listener: outside of inputs, printable keys append to the query. Space is
  prevented so the page doesn't scroll, Backspace edits, Escape clears.
- The query lives in a **floating pill search bar** at the bottom with a live spinner in semantic
  mode and a `visible/total` counter.
- Semantic mode debounces ~280 ms before hitting the API.
- `⇧R` toggles the rack (plain `r` is reserved for typing).

---

## 4. Changed / added relative to the original

1. **Postgres instead of SQLite**, with a real schema (`drizzle-kit push`) and a seed of 3 stacks,
   16 blocks and one composition so the studio is never empty on first load.
2. **Server-rendered public stack pages** with metadata for link previews.
3. **Archives is a first-class view** (restore / hard delete) instead of a silent delete.
4. **Keyboard rack toggle and keyboard rack reordering** — the original was pointer-only.
5. **OpenRouter export** is a genuine `messages` payload rather than a text dump.
6. **Sessions use `localStorage` with explicit quota messaging** instead of IndexedDB, so the
   storage-full path is visible and recoverable.
7. **No dead components** — only what the UI imports was ported.
8. **Tag colours are derived deterministically** from a golden-angle sequence, so an unknown tag
   always gets the same colour before you customise it.

---

## 5. Shortcuts

| Keys | Action |
| --- | --- |
| type `a–z 0–9 - _ space` | search (no click needed) |
| `Backspace` / `Escape` | edit query / clear query + filters |
| paste anywhere | create a block from the clipboard |
| `⌘/Ctrl + Enter` | save the quick creator · new session |
| `⌘/Ctrl + K` | focus sessions search |
| `⇧R` | toggle the rack |
| double-click a stack tab | rename the stack |
