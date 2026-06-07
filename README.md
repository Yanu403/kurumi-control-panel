# Kurumi Control Panel

A modular Telegram Mini App / web dashboard that hosts multiple service panels under a single tabbed interface.

## Initial Tabs

| Tab | Type | URL |
|-----|------|-----|
| 🤖 Hermes | iframe | `https://hermes.kurumiclaw.systems/` |
| 🔀 9Router | iframe | `https://9routers.kurumiclaw.systems/` |
| 🌐 CBM | iframe | `https://cbm.kurumiclaw.systems/` |

## Quick Start

```bash
# Install frontend deps
npm install

# Install backend deps
cd server && npm install && cd ..

# Dev mode (frontend only)
npm run dev

# Build + run full stack
npm run build
cd server && node index.js
# → http://localhost:9122
```

## Adding a New Tab

**Step 1:** Edit `src/tabs/registry.ts` — add entry to the `tabs` array:

```ts
{
  id: 'my-panel',
  label: 'My Panel',
  icon: '🪄',
  type: 'iframe',
  url: 'https://my-panel.example.com/',
  primary: true,  // true = bottom tab bar, false = "More" sheet
},
```

**Step 2:** Done. No other files need changing.

### Component Tabs

For tabs that need custom React UI (not just an iframe):

```ts
import { lazy } from 'react';

const MyPage = lazy(() => import('./pages/MyPage'));

{
  id: 'custom',
  label: 'Custom',
  icon: '⚙️',
  type: 'component',
  component: MyPage,
  primary: false,  // goes into "More" sheet
  desc: 'Custom panel with interactive UI',
}
```

Then create `src/pages/MyPage.tsx`.

## Architecture

```
src/
├── tabs/
│   └── registry.ts      ← single source of truth for all tabs
├── pages/
│   └── IframePanel.tsx   ← generic iframe renderer
├── components/
│   └── Toast.tsx          ← notification toasts
├── App.tsx                ← reads registry, renders active tab
├── App.css                ← styles
└── config.ts              ← app name, version, API base

server/
└── index.js               ← Express backend (health + SPA fallback)
```

## Deployment

Behind Caddy reverse proxy:

```
panel.kurumiclaw.systems {
    reverse_proxy 127.0.0.1:9122
}
```

## License

MIT
