import { useState, useRef, useCallback, useEffect } from 'react';
import AddressBar from './AddressBar';
import '../../styles/browser.css';

interface BrowserPaneProps {
  initialUrl?: string;
  surfaceId: string;
}

export default function BrowserPane({ initialUrl = 'https://github.com/amirlehmam/wmux', surfaceId: _surfaceId }: BrowserPaneProps) {
  const [url, setUrl] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const webviewRef = useRef<any>(null);

  const navigate = useCallback((newUrl: string) => {
    let resolved = newUrl;
    if (!newUrl.match(/^https?:\/\//)) {
      if (newUrl.includes('.') && !newUrl.includes(' ')) {
        resolved = 'https://' + newUrl;
      } else {
        resolved = `https://www.google.com/search?q=${encodeURIComponent(newUrl)}`;
      }
    }
    setUrl(resolved);
    if (webviewRef.current) {
      webviewRef.current.loadURL(resolved);
    }
  }, []);

  const goBack = useCallback(() => webviewRef.current?.goBack(), []);
  const goForward = useCallback(() => webviewRef.current?.goForward(), []);
  const reload = useCallback(() => webviewRef.current?.reload(), []);
  const stop = useCallback(() => webviewRef.current?.stop(), []);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const onNavigate = (e: any) => {
      setCurrentUrl(e.url);
      setCanGoBack(wv.canGoBack());
      setCanGoForward(wv.canGoForward());
    };
    const onStartLoad = () => setIsLoading(true);
    const onStopLoad = () => {
      setIsLoading(false);
      setCurrentUrl(wv.getURL());
    };

    wv.addEventListener('did-navigate', onNavigate);
    wv.addEventListener('did-navigate-in-page', onNavigate);
    wv.addEventListener('did-start-loading', onStartLoad);
    wv.addEventListener('did-stop-loading', onStopLoad);

    return () => {
      wv.removeEventListener('did-navigate', onNavigate);
      wv.removeEventListener('did-navigate-in-page', onNavigate);
      wv.removeEventListener('did-start-loading', onStartLoad);
      wv.removeEventListener('did-stop-loading', onStopLoad);
    };
  }, []);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    const onAttach = () => {
      const wcId = wv.getWebContentsId?.();
      if (wcId && window.wmux?.cdp?.attach) {
        window.wmux.cdp.attach(wcId);
      }
    };
    wv.addEventListener('dom-ready', onAttach);
    return () => {
      wv.removeEventListener('dom-ready', onAttach);
      window.wmux?.cdp?.detach?.();
    };
  }, []);

  return (
    <div className="browser-pane">
      <AddressBar
        url={currentUrl}
        isLoading={isLoading}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onNavigate={navigate}
        onBack={goBack}
        onForward={goForward}
        onReload={reload}
        onStop={stop}
      />
      {/* @ts-ignore — webview is an Electron-specific HTML element */}
      <webview
        ref={webviewRef}
        src={url}
        className="browser-pane__webview"
      />
    </div>
  );
}
