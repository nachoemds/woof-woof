// src/components/UserTagBadge.tsx
import React, { useEffect, useState } from 'react';
import { getTagColorDef, TagColorDef, isLightHex } from '../lib/tagColors';

interface UserTagBadgeProps {
  name?: string;
  colorId?: string;
  className?: string;
  showAvatar?: boolean;
  size?: 'xs' | 'sm' | 'md';
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

export const UserTagBadge: React.FC<UserTagBadgeProps> = ({
  name,
  colorId,
  className = '',
  showAvatar = true,
  size = 'sm',
  onClick,
  title,
}) => {
  const [colorDef, setColorDef] = useState<TagColorDef>(() =>
    getTagColorDef(name, colorId)
  );

  useEffect(() => {
    setColorDef(getTagColorDef(name, colorId));

    const handleColorUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (
        name &&
        detail?.identifier &&
        name.toLowerCase().includes(detail.identifier.toLowerCase())
      ) {
        setColorDef(getTagColorDef(name, detail.colorId));
      }
    };

    window.addEventListener('woof_color_updated', handleColorUpdate);
    return () => {
      window.removeEventListener('woof_color_updated', handleColorUpdate);
    };
  }, [name, colorId]);

  if (!name) {
    return (
      <span className="text-neutral-400 dark:text-neutral-500 italic text-[11px]">
        Sin asignar
      </span>
    );
  }

  const initial = name.trim().charAt(0).toUpperCase();

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
  }[size];

  const avatarSizes = {
    xs: 'w-3.5 h-3.5 text-[8px]',
    sm: 'w-4 h-4 text-[9px]',
    md: 'w-5 h-5 text-[10px]',
  }[size];

  // Soporte dinámico para selector de color libre (HEX)
  const isCustom = Boolean(colorDef.customHex);
  const badgeStyle = isCustom
    ? {
        backgroundColor: `${colorDef.customHex}15`,
        borderColor: `${colorDef.customHex}45`,
        color: colorDef.customHex,
      }
    : undefined;

  const avatarStyle = isCustom
    ? {
        backgroundColor: colorDef.customHex,
        color: isLightHex(colorDef.customHex!) ? '#171717' : '#ffffff',
      }
    : undefined;

  return (
    <span
      onClick={onClick}
      title={title || `Responsable: ${name}`}
      style={badgeStyle}
      className={`inline-flex items-center space-x-1.5 rounded-md font-semibold border transition-colors shadow-2xs ${
        !isCustom ? colorDef.badgeClass : ''
      } ${sizeClasses} ${
        onClick ? 'cursor-pointer hover:opacity-85' : ''
      } ${className}`}
    >
      {showAvatar && (
        <span
          style={avatarStyle}
          className={`${avatarSizes} rounded-full flex items-center justify-center font-bold shrink-0 ${
            !isCustom ? colorDef.avatarBg : ''
          }`}
        >
          {initial}
        </span>
      )}
      <span className="truncate max-w-[120px]">{name}</span>
    </span>
  );
};

export default UserTagBadge;
