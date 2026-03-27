import React, { useCallback, useEffect, useRef } from 'react';
import '../../styles/splitpane.css';

interface SplitDividerProps {
  direction: 'horizontal' | 'vertical';
  onRatioChange: (delta: number) => void;
  onDoubleClick?: () => void;
}

export default function SplitDivider({ direction, onRatioChange, onDoubleClick }: SplitDividerProps) {
  const draggingRef = useRef(false);
  const startPosRef = useRef(0);
  const dividerRef = useRef<HTMLDivElement | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
    },
    [direction],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !dividerRef.current) return;

      const parent = dividerRef.current.parentElement;
      if (!parent) return;

      const parentRect = parent.getBoundingClientRect();
      const parentSize =
        direction === 'horizontal' ? parentRect.width : parentRect.height;

      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = (currentPos - startPosRef.current) / parentSize;
      startPosRef.current = currentPos;

      onRatioChange(delta);
    };

    const onMouseUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [direction, onRatioChange]);

  return (
    <div
      ref={dividerRef}
      className={`split-divider split-divider--${direction}`}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      <div className="split-divider__line" />
    </div>
  );
}
