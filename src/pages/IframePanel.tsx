import { useState, useRef, useEffect } from 'react';

interface Props {
  url: string;
}

export default function IframePanel({ url }: Props) {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setLoading(true);
  }, [url]);

  return (
    <div className="iframe-container">
      {loading && (
        <div className="iframe-loading">
          <div className="spinner" />
          <span>Loading…</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={url}
        className="iframe-panel"
        onLoad={() => setLoading(false)}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        allow="clipboard-read; clipboard-write"
        title={url}
      />
    </div>
  );
}
