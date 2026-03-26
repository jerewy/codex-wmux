import { useState, useRef, useCallback, KeyboardEvent, ChangeEvent } from 'react';

interface AddressBarProps {
  url: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onStop: () => void;
  onDevTools?: () => void;
}

export default function AddressBar({
  url,
  isLoading,
  canGoBack,
  canGoForward,
  onNavigate,
  onBack,
  onForward,
  onReload,
  onStop,
  onDevTools,
}: AddressBarProps) {
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayUrl = editingUrl !== null ? editingUrl : url;

  const handleFocus = useCallback(() => {
    setEditingUrl(url);
    // Select all text on focus
    requestAnimationFrame(() => {
      inputRef.current?.select();
    });
  }, [url]);

  const handleBlur = useCallback(() => {
    setEditingUrl(null);
  }, []);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEditingUrl(e.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const val = (editingUrl ?? url).trim();
        if (val) {
          onNavigate(val);
        }
        inputRef.current?.blur();
      } else if (e.key === 'Escape') {
        setEditingUrl(null);
        inputRef.current?.blur();
      }
    },
    [editingUrl, url, onNavigate],
  );

  return (
    <div className="browser-address-bar">
      <button
        className="browser-address-bar__btn"
        disabled={!canGoBack}
        onClick={onBack}
        title="Back"
        aria-label="Back"
      >
        &#8592;
      </button>
      <button
        className="browser-address-bar__btn"
        disabled={!canGoForward}
        onClick={onForward}
        title="Forward"
        aria-label="Forward"
      >
        &#8594;
      </button>
      <button
        className="browser-address-bar__btn"
        onClick={isLoading ? onStop : onReload}
        title={isLoading ? 'Stop' : 'Reload'}
        aria-label={isLoading ? 'Stop' : 'Reload'}
      >
        {isLoading ? '\u2715' : '\u21BB'}
      </button>
      {onDevTools && (
        <button
          className="browser-address-bar__btn"
          onClick={onDevTools}
          title="Open DevTools for this page"
          aria-label="DevTools"
        >
          &#9881;
        </button>
      )}
      <input
        ref={inputRef}
        className="browser-address-bar__url"
        type="text"
        value={displayUrl}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}
