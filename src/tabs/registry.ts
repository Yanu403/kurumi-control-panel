/**
 * Tab Registry — single source of truth for all tabs.
 *
 * To add a new tab:
 *   1. Add an entry to the `tabs` array below
 *   2. If type is 'component', create the page in src/pages/
 *   3. Done — no other files need changing
 */

export interface TabDef {
  id: string;
  label: string;
  icon: string;
  type: 'iframe' | 'component';
  url?: string;
  component?: React.LazyExoticComponent<React.ComponentType>;
  desc?: string;
  primary?: boolean;
}

const tabs: TabDef[] = [
  {
    id: 'hermes',
    label: 'Hermes',
    icon: '🤖',
    type: 'iframe',
    url: 'https://hermes.kurumiclaw.systems/',
    primary: true,
  },
  {
    id: '9router',
    label: '9Router',
    icon: '🔀',
    type: 'iframe',
    url: 'https://9routers.kurumiclaw.systems/',
    primary: true,
  },
  {
    id: 'cbm',
    label: 'CBM',
    icon: '🌐',
    type: 'iframe',
    url: 'https://cbm.kurumiclaw.systems/',
    primary: true,
  },
];

export const primaryTabs = tabs.filter((t) => t.primary !== false);
export const secondaryTabs = tabs.filter((t) => t.primary === false);
export const allTabs = tabs;
export default tabs;
