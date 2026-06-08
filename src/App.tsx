import { lazy, useState, Suspense, useEffect } from 'react';
import { primaryTabs, secondaryTabs, allTabs, type TabDef } from './tabs/registry';
import Toast from './components/Toast';
import './App.css';

const IframePanel = lazy(() => import('./pages/IframePanel'));

function isTelegramWebView(): boolean {
  try {
    // Check for Telegram WebApp SDK presence
    const wa = (window as any).Telegram?.WebApp;
    if (!wa) return false;
    // In Mini App context, platform is set (ios/android/tdesktop/web)
    // Also accept if initData or initDataUnsafe is present
    return !!(wa.initData || wa.platform || wa.initDataUnsafe?.user);
  } catch {
    return false;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<TabDef>(primaryTabs[0] || allTabs[0]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isTg, setIsTg] = useState<boolean | null>(null);

  useEffect(() => {
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
      return (
        <Suspense key={tab.id} fallback={<div className="iframe-loading"><div className="spinner" /></div>}>
          <IframePanel url={tab.url} />
        </Suspense>
      );
    }
    if (tab.type === 'external' && tab.url) {
      // Open external service in Telegram's built-in browser
      try { (window as any).Telegram?.WebApp?.openLink(tab.url); } catch { window.open(tab.url, '_blank'); }
      return (
        <div className="auth-gate">
          <div className="auth-gate-icon">🔀</div>
          <div className="auth-gate-title">9Router</div>
          <div className="auth-gate-desc">
            Opened in external browser. Tap below if it didn't open.
          </div>
          <a href={tab.url} target="_blank" rel="noopener" className="btn btn-primary">
            Open 9Router
          </a>
        </div>
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

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="header-title">Kurumi Control Panel</span>
        </div>
        <div className="header-right">
          <span className="header-icon">{activeTab.icon}</span>
          <span className="header-tab-name">{activeTab.label}</span>
        </div>
      </header>

      {/* Page content */}
      <main className="main">
        {renderPage()}
      </main>

      {/* Bottom nav — primary tabs */}
      <nav className="bottom-nav">
        {primaryTabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-item ${activeTab.id === tab.id ? 'active' : ''}`}
            onClick={() => selectTab(tab)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}

        {/* More button */}
        {secondaryTabs.length > 0 && (
          <div className="nav-more-wrapper">
            <button
              className={`nav-item ${moreOpen ? 'active' : ''}`}
              onClick={() => setMoreOpen(!moreOpen)}
            >
              <span className="nav-icon">⋯</span>
              <span className="nav-label">More</span>
            </button>
            {moreOpen && (
              <div className="more-popup">
                {secondaryTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`more-item ${activeTab.id === tab.id ? 'active' : ''}`}
                    onClick={() => selectTab(tab)}
                  >
                    <span className="more-icon">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <Toast />
    </div>
  );
}

export default App;
