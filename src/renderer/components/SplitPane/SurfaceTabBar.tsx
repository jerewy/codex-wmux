import React, { useState } from 'react';
import { SurfaceRef, SurfaceId, PaneId } from '../../../shared/types';

interface SurfaceTabBarProps {
  paneId: PaneId;
  surfaces: SurfaceRef[];
  activeSurfaceIndex: number;
  onSelect: (index: number) => void;
  onClose: (surfaceId: SurfaceId) => void;
  onNew: () => void;
  onDropSurface?: (sourcePaneId: PaneId, surfaceId: SurfaceId, targetPaneId: PaneId) => void;
}

function surfaceIcon(type: string): string {
  switch (type) {
    case 'terminal': return '>';
    case 'browser': return '◎';
    case 'markdown': return '¶';
    default: return '○';
  }
}

function surfaceLabel(surface: SurfaceRef): string {
  switch (surface.type) {
    case 'terminal': return 'Terminal';
    case 'browser': return 'Browser';
    case 'markdown': return 'Markdown';
    default: return 'Tab';
  }
}

export default function SurfaceTabBar({
  paneId,
  surfaces,
  activeSurfaceIndex,
  onSelect,
  onClose,
  onNew,
  onDropSurface,
}: SurfaceTabBarProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Always show tab bar (even for 1 surface — like browser tabs)
  return (
    <div
      className="surface-tab-bar"
      role="tablist"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOverIndex(null);
        const data = e.dataTransfer.getData('application/wmux-surface');
        if (data && onDropSurface) {
          try {
            const { sourcePaneId, surfaceId } = JSON.parse(data);
            if (sourcePaneId !== paneId) {
              onDropSurface(sourcePaneId as PaneId, surfaceId as SurfaceId, paneId);
            }
          } catch {}
        }
      }}
      onDragLeave={() => setDragOverIndex(null)}
    >
      <div className="surface-tab-bar__tabs">
        {surfaces.map((surface, index) => {
          const isActive = index === activeSurfaceIndex;
          return (
            <div
              key={surface.id}
              className={[
                'surface-tab',
                isActive ? 'surface-tab--active' : '',
                dragOverIndex === index ? 'surface-tab--drag-over' : '',
              ].filter(Boolean).join(' ')}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(index)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  'application/wmux-surface',
                  JSON.stringify({ sourcePaneId: paneId, surfaceId: surface.id })
                );
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIndex(index);
              }}
            >
              <span className="surface-tab__icon">{surfaceIcon(surface.type)}</span>
              <span className="surface-tab__label">{surfaceLabel(surface)}</span>
              {surfaces.length > 1 && (
                <button
                  className="surface-tab__close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(surface.id);
                  }}
                  tabIndex={-1}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        className="surface-tab-bar__new-btn"
        onClick={onNew}
        tabIndex={-1}
        title="New tab (Ctrl+T)"
      >
        +
      </button>
    </div>
  );
}
