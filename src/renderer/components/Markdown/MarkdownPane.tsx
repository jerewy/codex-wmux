import { useCallback, useMemo } from 'react';
import { marked } from 'marked';
import { openInWmuxBrowser } from '../../utils/open-in-browser';
import '../../styles/markdown.css';

interface MarkdownPaneProps {
  content?: string;
  surfaceId: string;
}

export default function MarkdownPane({ content = '', surfaceId }: MarkdownPaneProps) {
  const html = useMemo(() => {
    if (!content) return '<p style="opacity: 0.5">No content. Use wmux markdown set to add content.</p>';

    marked.setOptions({
      gfm: true,
      breaks: true,
    });

    return marked.parse(content) as string;
  }, [content]);

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null;
    if (!anchor?.href) return;

    event.preventDefault();
    const forceExternal = event.ctrlKey || event.metaKey;
    openInWmuxBrowser(anchor.href, { forceExternal });
  }, []);

  return (
    <div className="markdown-pane" data-surface-id={surfaceId}>
      <div
        className="markdown-pane__content"
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
