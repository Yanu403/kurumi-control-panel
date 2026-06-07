# Kurumi Control Panel — TASK BRIEF

## Project
- Location: `/root/projects/kurumi-control-panel`
- Base: `hermes-miniapp-template` (React + Vite + Express backend)
- Purpose: Telegram Mini App / web dashboard that hosts multiple service panels under a single tabbed interface.

## Goal
Transform the template into a modular multi-panel dashboard called **"Kurumi Control Panel"** with 3 initial tabs:
1. **Hermes** — embeds Hermes dashboard at `https://hermes.kurumiclaw.systems/`
2. **9Router** — embeds 9Router at `https://9routers.kurumiclaw.systems/`
3. **CloakBrowser** — embeds CBM at `https://cbm.kurumiclaw.systems/`

## Architecture

### Tab System (CRITICAL — must be extensible)
Each tab is defined in a single config file `src/tabs/registry.ts`:
```ts
export interface TabDef {
  id: string;
  label: string;
  icon: string;
  type: 'iframe' | 'component';
  url?: string;           // for iframe type
  component?: () => JSX.Element; // for component type
  desc?: string;          // shown in "More" sheet if secondary
  primary?: boolean;      // true = shown in bottom tab bar, false = in "More" sheet
}

export const tabs: TabDef[] = [
  { id: 'hermes', label: 'Hermes', icon: '🤖', type: 'iframe', url: 'https://hermes.kurumiclaw.systems/', primary: true },
  { id: '9router', label: '9Router', icon: '🔀', type: 'iframe', url: 'https://9routers.kurumiclaw.systems/', primary: true },
  { id: 'cbm', label: 'CBM', icon: '🌐', type: 'iframe', url: 'https://cbm.kurumiclaw.systems/', primary: true },
];
```

To add a new tab in the future:
1. Add entry to `tabs` array in `src/tabs/registry.ts`
2. If `type: 'component'`, create page in `src/pages/`
3. Done. No other files need changing.

### Iframe Rendering
- Create `src/pages/IframePanel.tsx` — renders an iframe for the given URL
- The iframe should fill the entire page content area (100% width/height, no border)
- Add loading state while iframe loads
- Iframe needs `sandbox="allow-same-origin allow-scripts allow-popups allow-forms"` for embedded dashboards

### App.tsx Refactor
- Remove hardcoded `primaryTabs` / `secondaryTabs` arrays
- Import from `src/tabs/registry.ts`
- `primaryTabs` = `tabs.filter(t => t.primary !== false)`
- `secondaryTabs` = `tabs.filter(t => t.primary === false)`
- `renderPage()` switches on `activeTab.id`:
  - If `tab.type === 'iframe'` → render `<IframePanel url={tab.url} />`
  - If `tab.type === 'component'` → render the component

### Config Changes
- `APP_NAME` = `'Kurumi Control Panel'`
- `APP_VERSION` = `'1.0.0'`
- Remove the example tools (Text Transform, JSON Formatter) — not needed

### Server Changes
- Keep the Express server as a thin proxy
- Add `/api/proxy` endpoint that forwards requests to internal services (for future API integrations)
- Keep `/api/health`
- Remove example tool endpoints (`/api/tools/*`)
- PORT stays 9122

### Styling
- Keep the existing dark theme CSS (it's already clean)
- Tab bar: 3 primary tabs (Hermes, 9Router, CBM) — no "More" button initially
- Tab bar should work well on mobile (Telegram Mini App context)
- Add a subtle header bar at top showing "Kurumi Control Panel" with the active tab name

### Caddy Integration (deployment)
The app will be deployed behind Caddy at a new subdomain (e.g. `panel.kurumiclaw.systems`).
- Backend: `http://127.0.0.1:9122`
- Caddy handles TLS + reverse proxy
- No CORS issues since iframes point to same domain (`*.kurumiclaw.systems`)

## Files to Create/Modify
1. `src/tabs/registry.ts` — NEW, tab definitions
2. `src/pages/IframePanel.tsx` — NEW, iframe renderer
3. `src/App.tsx` — REWRITE, use registry
4. `src/config.ts` — UPDATE, app name
5. `src/pages/Home.tsx` — DELETE (replaced by tabs)
6. `src/pages/Tools.tsx` — DELETE (replaced by tabs)
7. `server/index.js` — SIMPLIFY, remove example tools
8. `package.json` — UPDATE name to `kurumi-control-panel`
9. `README.md` — UPDATE, document how to add tabs

## Constraints
- Pure React + Vite + TypeScript + Express (no extra deps)
- Must work as Telegram Mini App (mobile-first, max-width ~480px)
- Must work behind Caddy reverse proxy
- All services are on `*.kurumiclaw.systems` — same parent domain, so iframe should work
- No auth for now (services handle their own auth)
- Keep the codebase clean and minimal — no over-engineering

## Verification
After implementation:
1. `cd /root/projects/kurumi-control-panel && npm install && npm run build` — must succeed
2. `cd server && npm install && node index.js &` — server starts on :9122
3. `curl http://localhost:9122/api/health` — returns `{ status: 'ok' }`
4. Open `http://localhost:9122` — shows 3 tabs, each renders iframe
