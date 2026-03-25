import React, { useCallback } from 'react';

interface SidebarResizeHandleProps {
  onWidthChange: (delta: number) => void;
}

export default function SidebarResizeHandle({ onWidthChange }: SidebarResizeHandleProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        onWidthChange(delta);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [onWidthChange],
  );

  return (
    <div
      className="sidebar-resize-handle"
      onMouseDown={handleMouseDown}
    />
  );
}
