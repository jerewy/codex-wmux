import React from 'react';

interface UnreadBadgeProps {
  count: number;
  isSelected: boolean;
}

export default function UnreadBadge({ count, isSelected }: UnreadBadgeProps) {
  return (
    <span
      className={`unread-badge ${isSelected ? 'unread-badge--selected' : ''}`}
      title={`${count} unread notification${count === 1 ? '' : 's'}`}
    >
      {count}
    </span>
  );
}
