import React from 'react';
import { getInitials } from '../utils/formatters';

export interface UserAvatarProps {
  displayName: string;
  avatarColor?: string;
  avatarDataUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function UserAvatar({
  displayName,
  avatarColor,
  avatarDataUrl,
  size = 'md',
  className = '',
}: UserAvatarProps): React.ReactElement {
  const sizeClass = size === 'md' ? '' : `user-avatar--${size}`;
  const combinedClass = ['user-avatar', sizeClass, className]
    .filter(Boolean)
    .join(' ');

  if (avatarDataUrl) {
    return (
      <span className={combinedClass}>
        <img
          src={avatarDataUrl}
          alt={displayName}
          className="user-avatar__img"
        />
      </span>
    );
  }

  return (
    <span
      className={combinedClass}
      style={
        avatarColor
          ? { backgroundColor: avatarColor, color: '#FFFFFF' }
          : undefined
      }
      aria-hidden="true"
    >
      {getInitials(displayName)}
    </span>
  );
}
