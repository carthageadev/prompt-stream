# Tech Stack & Library Decisions
- Frontend: React 19 + Vite 6 + TypeScript 5.8 (existing stack, fast dev/build, strong type safety).
- Styling: Tailwind (CDN, utility-first) + CSS variables for theming (minimal new dependencies, predictable overrides).
- UI/UX: GSAP for modal transitions (already in use, consistent motion), Lucide icons.
- DnD: @dnd-kit (already used for reorder/mixer interactions).
- Backend: FastAPI + SQLAlchemy async + PostgreSQL (existing, async-friendly, stable ecosystem).
- Dev/Build: Bun for frontend install/build, Docker Compose for full stack.

# Interpreted Feature Summary
Enable dark/light theme with a settings toggle, add an About section in settings, fix tag-color editing blank-screen bug, add auto-tagging toggle, and tighten UI density (compact tag pills, prompt cards, remove empty card footers). Ensure tags are labeled as “Tags,” keep tag colors vivid, and preserve unique auto-assigned colors for new tags.

# Assumptions & Unknowns
- Assumption: Theme toggles only need to affect the prompt-manager UI (not re-architect BuildStream light-mode area).
- Assumption: Auto-tagging should apply only on creation (not retroactive).
- Unknown: Any downstream analytics or telemetry requirements for settings changes.
- Unknown: Whether tag color uniqueness must be enforced across historical data (handled at creation/update level only).

# Success Criteria
## User Success
- Users can toggle dark/light theme and see clear visual changes without crashes.
- Settings shows About info and controls for theme, auto-tagging, and radius.
- Tag color editor no longer blanks the screen; custom colors persist with hue + lightness controls.
- Tag pills are compact and do not expand into neighbors when active.
- Prompt cards are tighter with no empty footer area when unused.

## System / Business Success
- Build passes and app starts with theme support enabled.
- No new runtime errors from settings or tag rendering.

## Non-Goals
- Redesign of non-core views not directly tied to prompt management.
- New authentication, multi-user access, or external integrations.

## Constraints & Assumptions
- Keep existing stack and avoid new major dependencies.
- Maintain backwards compatibility with stored tag colors (including missing lightness).

# UX Plan
## Primary Flow
1) Open settings → toggle theme → see immediate UI change.
2) Select tag → adjust hue/lightness → tag pills update live.
3) Toggle auto-tagging → affects new prompt creation only.

## UI States & Edge Cases
- No tags: settings editor shows placeholder state.
- Tag deleted while selected: selection resets safely.
- Missing lightness on legacy tag colors: fallback to default lightness.

## Accessibility
- Maintain clear contrast between text and background in both themes.
- Keep buttons focusable and readable (no color-only meaning for state).

## UX Copy / Messaging
- Use “Tags” consistently (not “Tabs”).
- “Auto Tagging” toggle indicates Enabled/Disabled explicitly.

# Technical Strategy (Conceptual)
## Architecture Overview
- Frontend React state holds UI prefs (theme, radius, auto-tagging) with localStorage persistence.
- Backend remains unchanged; frontend uses existing APIs for blocks, stacks, and tag colors.

## Data Model
- Tag colors: { name, hue, lightness } with defaults when lightness missing.
- Settings (theme, radius, auto-tagging) stored in localStorage only.

## API Contracts
- No new endpoints required; reuse tag color update endpoints.

## Security & Privacy
- No new PII; settings stored locally.

## Performance Considerations
- Theme uses CSS variables; avoids re-render-heavy approaches.

## Logging / Monitoring
- No new telemetry added.

## Migration Strategy
- Lightness fallback on read to support existing rows without lightness.

# Risks & Tradeoffs
- Mixed-theme areas could remain if parts of UI stay hard-coded (mitigated by CSS variables in core views).
- No automated tests added due to lack of framework (not ideal).

# Step-by-Step Execution Plan
## Milestone 1
Objective: Add theme + settings controls and persistence.
- Update settings UI for About + theme + auto-tag toggles.
- Persist preferences in localStorage.
- Validation: build passes; toggles update UI.

## Milestone 2
Objective: Fix tag color editor and compact UI.
- Add lightness fallback to prevent crashes.
- Compact tag pills and prompt cards; remove empty footers.
- Validation: select tags, adjust hue/lightness, no blank screen.

## Milestone 3
Objective: Theming surfaces and build verification.
- Apply CSS variables to key surfaces/components.
- Run docker build.

# Implementation Summary (What Was Built)
## Key Decisions
- CSS variable theming with body data-theme for minimal footprint and fast toggles.
- Safe fallbacks for missing tag color lightness to prevent runtime errors.

## Files / Modules Overview
- `frontend/index.html`: theme variables, light/dark overrides, default data-theme.
- `frontend/App.tsx`: theme + auto-tag state, body dataset, toast theming.
- `frontend/components/SettingsOverlay.tsx`: About + theme + auto-tag + radius controls, bug fix.
- `frontend/components/TagFilterBar.tsx`: compact tag pills, Tags label.
- `frontend/components/PromptCard.tsx`: compact layout, no empty footer.
- `frontend/components/PromptGrid.tsx`: themed empty state.
- `frontend/components/EditorOverlay.tsx`, `frontend/components/QuickCreator.tsx`, `frontend/components/Mixer.tsx`: themed surfaces.
- `frontend/constants.tsx`: lightness fallback.

## Feature Flags / Rollout Notes
- None. Theme toggle is local and immediate.

# Test & Validation Plan
## Tests Added
- None (no existing test framework in repo).

## Commands Executed (With Results)
- `docker compose build` (frontend + backend). Result: success; Vite build completed with warning that `/index.css` is not present at build time.

# Production Readiness Checklist
- Environment variables documented and used by Docker Compose.
- Theme settings stored locally, no sensitive data added.
- Build succeeds in Docker.

# Deployment Guide
- Build images: `docker compose build`.
- Run stack: `docker compose up`.
- Frontend served by nginx container, backend on FastAPI container.

# Rollback Plan
- Redeploy previous Docker images or reset to prior git commit.

# Handoff Pack for Implementation Agents
## Ordered Checklist
- Verify theme toggle on multiple screen sizes.
- Validate tag color editor on legacy tags without lightness.
- Smoke test create prompt with auto-tagging on/off.
- Confirm compact tag pills and prompt cards.

## Definition of Done
- Theme toggle works and persists.
- Tag color editor no longer crashes.
- UI compaction applied (tags + cards).
- Docker build completes.

## What NOT to Change Without Revisiting the Plan
- Theme variables and data-theme contract.
- Tag color lightness fallback behavior.
