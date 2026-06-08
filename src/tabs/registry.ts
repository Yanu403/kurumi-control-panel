/**
 * Tab Registry — single source of truth for all tabs.
 */

export interface TabDef {
  id: string;
  label: string;
  icon: string;
  type: 'iframe' | 'component' | 'external';
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
    url: '/proxy/hermes/',
    primary: true,
  },
  {
    id: '9router',
    label: '9Router',
    icon: '🔀',
    type: 'external',
    url: 'https://9routers.kurumiclaw.systems/',
    primary: true,
  },
];

export const primaryTabs = tabs.filter((t) => t.primary !== false);
export const secondaryTabs = tabs.filter((t) => t.primary === false);
export const allTabs = tabs;
export default tabs;
