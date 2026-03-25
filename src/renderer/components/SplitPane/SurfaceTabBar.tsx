import React from 'react';
import { SurfaceRef, SurfaceId } from '../../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SurfaceTabBarProps {
  surfaces: SurfaceRef[];
  activeSurfaceIndex: number;
  onSelect: (index: number) => void;
  onClose: (surfaceId: SurfaceId) => void;
  onNew: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function surfaceLabel(surface: SurfaceRef, index: number): string {
  switch (surface.type) {
    case 'terminal':
      return `Terminal ${index + 1}`;
    case 'browser':
      return `Browser ${index + 1}`;
    case 'markdown':
      return `Markdown ${index + 1}`;
    default:
      return `Tab ${index + 1}`;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SurfaceTabBar({
  surfaces,
  activeSurfaceIndex,
  onSelect,
  onClose,
  onNew,
}: SurfaceTabBarProps) {
  // Only render when there are 2 or more surfaces
  if (surfaces.length < 2) return null;

  return (
    <div className="surface-tab-bar" role="tablist" aria-label="Surface tabs">
      <div className="surface-tab-bar__tabs">
        {surfaces.map((surface, index) => {
          const isActive = index === activeSurfaceIndex;
          return (
            <div
              key={surface.id}
              className={`surface-tab${isActive ? ' surface-tab--active' : ''}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(index)}
            >
              <span className="surface-tab__label">{surfaceLabel(surface, index)}</span>
              <button
                className="surface-tab__close"
                aria-label={`Close ${surfaceLabel(surface, index)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(surface.id);
                }}
                tabIndex={-1}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <button
        className="surface-tab-bar__new-btn"
        aria-label="New surface"
        onClick={onNew}
        tabIndex={-1}
      >
        +
      </button>
    </div>
  );
}
