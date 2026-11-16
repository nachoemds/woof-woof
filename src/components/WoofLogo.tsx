// src/components/WoofLogo.tsx
import React, { useState } from 'react';

interface WoofLogoProps {
  className?: string;
  size?: number;
  animated?: boolean;
}

/**
 * Componente oficial de producción del Isotipo "Yema".
 * Carga directamente el archivo oficial /isoYema.svg de la carpeta public/.
 */
export const WoofLogo: React.FC<WoofLogoProps> = ({ 
  className = "w-8 h-8", 
  size, 
  animated = false 
}) => {
  const [svgSource, setSvgSource] = useState<string>('/isoYema.svg');
  const [imageError, setImageError] = useState(false);

  const style = size ? { width: size, height: size } : undefined;

  // Carga directa del archivo oficial isoYema.svg
  if (!imageError) {
    return (
      <div 
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        style={style}
      >
        <img
          src={svgSource}
          alt="Isotipo Oficial Yema"
          className={`w-full h-full object-contain select-none ${animated ? 'hover:scale-105 transition-transform duration-200' : ''}`}
          onError={() => {
            if (svgSource === '/isoYema.svg') {
              setSvgSource('/IsoYema.svg');
            } else if (svgSource === '/IsoYema.svg') {
              setSvgSource('/iso.svg');
            } else {
              setImageError(true);
            }
          }}
        />
      </div>
    );
  }

  // Respaldo en caso de que aún no se haya copiado el archivo en public/
  return (
    <div 
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      style={style}
    >
      <img
        src="/isoYema.svg"
        alt="Isotipo Yema"
        className="w-full h-full object-contain select-none"
      />
    </div>
  );
};

export default WoofLogo;
