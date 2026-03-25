import React from 'react';
import '../../styles/titlebar.css';

interface TitlebarProps {
  title?: string;
  onHelpClick?: () => void;
}

export default function Titlebar({ title, onHelpClick }: TitlebarProps) {
  return (
    <div className="titlebar">
      <span className="titlebar__title">{title ?? ''}</span>
      <button className="titlebar__help-btn" onClick={onHelpClick} title="Help / Tutorial">
        ?
      </button>
    </div>
  );
}
