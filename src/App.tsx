import { lazy, useState, Suspense, useEffect } from 'react';
import { primaryTabs, secondaryTabs, allTabs, type TabDef } from './tabs/registry';
import Toast from './components/Toast';
import './App.css';

const IframePanel = lazy(() => import('./pages/IframePanel'));

function getInitData(): string {
  try {
    return (window as any).Telegram?.WebApp?.initData || '';
  } catch {
    return '';
  }
}

function isTelegramWebView(): boolean {
  try {
    return !!(window as any).Telegram?.WebApp?.initData;
  } catch {
    return false;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<TabDef>(primaryTabs[0] || allTabs[0]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isTg, setIsTg] = useState<boolean | null>(null);
  const initData = getInitData();

  useEffect(() => {
    // Check on mount — Telegram WebApp SDK loads async
    const check = () => {
      const tg = isTelegramWebView();
      setIsTg(tg);
      if (tg) {
        try { (window as any).Telegram.WebApp.ready(); } catch {}
      }
    };
    // Give SDK a moment to load
    setTimeout(check, 300);
  }, []);

  // Still checking
  if (isTg === null) {
    return (
      <div className="app">
        <div className="auth-gate">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  // Not inside Telegram — block access
  if (!isTg) {
    return (
      <div className="app">
        <div className="auth-gate">
          <div className="auth-gate-icon">🔒</div>
          <div className="auth-gate-title">Access Denied</div>
          <div className="auth-gate-desc">
            Open this page from the Telegram Mini App.
          </div>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    const tab = activeTab;
    if (tab.type === 'iframe' && tab.url) {
      // Pass Telegram initData to iframe so embedded services can verify
      const sep = tab.url.includes('?') ? '&' : '?';
      const iframeUrl = initData ? `${tab.url}${sep}initData=${encodeURIComponent(initData)}` : tab.url;
      return (
        <Suspense key={tab.id} fallback={<div className="iframe-loading"><div className="spinner" /></div>}>
          <IframePanel url={iframeUrl} />
        </Suspense>
      );
    }
    if (tab.type === 'component' && tab.component) {
      const Comp = tab.component;
      return <Comp />;
    }
    return <div className="card"><p>Tab not configured</p></div>;
  };

  const selectTab = (tab: TabDef) => {
    setActiveTab(tab);
    setMoreOpen(false);
  };

  const hasSecondary = secondaryTabs.length > 0;
  const isSecondaryActive = secondaryTabs.some((t) => t.id === activeTab.id);

  return (
    <div className="app">
      {/* Top header */}
      <div className="top-header">
        <span className="top-header-title">Kurumi Control Panel</span>
        <span className="top-header-tab">{activeTab.icon} {activeTab.label}</span>
      </div>

      <div className="page-content">
        {renderPage()}
      </div>

      <nav className="tab-bar">
        {primaryTabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab.id === tab.id ? 'active' : ''}`}
            onClick={() => selectTab(tab)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
        {hasSecondary && (
          <button
            className={`tab-item ${isSecondaryActive || moreOpen ? 'active' : ''}`}
            onClick={() => setMoreOpen(true)}
          >
            <span className="tab-icon">⋯</span>
            <span className="tab-label">More</span>
          </button>
        )}
      </nav>

      {hasSecondary && (
        <>
          <div
            className={`sheet-backdrop ${moreOpen ? 'open' : ''}`}
            onClick={() => setMoreOpen(false)}
          />
          <div className={`more-sheet ${moreOpen ? 'open' : ''}`}>
            <div className="sheet-handle" onClick={() => setMoreOpen(false)} />
            <div className="sheet-title">All Panels</div>
            <div className="sheet-list">
              {secondaryTabs.map((tab) => {
                const sep = tab.url?.includes('?') ? '&' : '?';
                const iframeUrl = tab.url && initData ? `${tab.url}${sep}initData=${encodeURIComponent(initData)}` : tab.url;
                return (
                  <button
                    key={tab.id}
                    className={`sheet-row ${activeTab.id === tab.id ? 'active' : ''}`}
                    onClick={() => selectTab({ ...tab, url: iframeUrl || tab.url })}
                  >
                    <span className="sheet-row-icon">{tab.icon}</span>
                    <span className="sheet-row-text">
                      <span className="sheet-row-label">{tab.label}</span>
                      {tab.desc && <span className="sheet-row-desc">{tab.desc}</span>}
                    </span>
                    <span className="sheet-row-chevron">›</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <Toast />
    </div>
  );
}

export default App;
