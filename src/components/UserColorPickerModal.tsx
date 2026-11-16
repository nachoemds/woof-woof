// src/components/UserColorPickerModal.tsx
import React, { useState } from 'react';
import { X, Check, Palette, Pipette, RotateCcw } from 'lucide-react';
import { TAG_COLOR_OPTIONS, TagColorDef, getTagColorDef } from '../lib/tagColors';
import { ticketsService } from '../lib/supabase';
import { UserTagBadge } from './UserTagBadge';

interface UserColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail?: string;
  userId?: string;
  currentColor?: string;
  onColorChanged?: (newColorId: string) => void;
}

export const UserColorPickerModal: React.FC<UserColorPickerModalProps> = ({
  isOpen,
  onClose,
  userName,
  userEmail,
  userId,
  currentColor,
  onColorChanged,
}) => {
  // Inicializar con el color actual o fallback
  const initialDef = getTagColorDef(userName, currentColor);
  const initialColor = currentColor || initialDef.customHex || initialDef.id;

  // Estado temporal de prueba (NO guarda hasta hacer clic en Aceptar)
  const [selectedColor, setSelectedColor] = useState<string>(initialColor);
  const [hexInput, setHexInput] = useState<string>(() => {
    if (initialColor.startsWith('#')) return initialColor;
    return initialDef.customHex || '#2563eb';
  });
  const [guardando, setGuardando] = useState(false);

  if (!isOpen) return null;

  // Actualizar color seleccionado desde el picker o paleta rápida
  const handleColorChange = (newColor: string) => {
    setSelectedColor(newColor);
    if (newColor.startsWith('#')) {
      setHexInput(newColor);
    } else {
      const def = TAG_COLOR_OPTIONS.find((c) => c.id === newColor);
      if (def?.customHex) setHexInput(def.customHex);
    }
  };

  // Manejar cambio manual en el input de texto hexadecimal
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#')) val = `#${val}`;
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setSelectedColor(val);
    }
  };

  // Guardar definitivamente al presionar el botón "Aceptar"
  const handleAceptar = async () => {
    setGuardando(true);
    try {
      const colorFinal = selectedColor.startsWith('#') ? selectedColor.toLowerCase() : selectedColor;
      const identifier = userId || userEmail || userName;
      await ticketsService.updateUserColor(identifier, colorFinal, userName);
      if (onColorChanged) {
        onColorChanged(colorFinal);
      }
      onClose();
    } catch (err) {
      console.error('Error al guardar color:', err);
    } finally {
      setGuardando(false);
    }
  };

  // Restablecer al color inicial
  const handleReset = () => {
    setSelectedColor(initialColor);
    setHexInput(initialColor.startsWith('#') ? initialColor : (initialDef.customHex || '#2563eb'));
  };

  const currentColorHex = selectedColor.startsWith('#') 
    ? selectedColor 
    : (TAG_COLOR_OPTIONS.find((c) => c.id === selectedColor)?.customHex || hexInput);

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera fija */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/70 dark:bg-[#252525]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-400/15 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/30">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Personalizar Color de Etiqueta
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Elige cualquier color libre o un tono de la paleta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo con Scroll Asegurado */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 [scrollbar-width:thin] [scrollbar-color:#d4d4d4_transparent] dark:[scrollbar-color:#404040_transparent]">
          
          {/* Previsualización limpia sin texto redundante */}
          <div className="p-3.5 bg-neutral-50 dark:bg-[#262626] rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-center">
            <UserTagBadge
              name={userName}
              colorId={selectedColor}
              size="md"
            />
          </div>

          {/* SELECTOR DE COLOR LIBRE (FULL SPECTRUM / CUALQUIER COLOR) */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#1a1a1a] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5">
                <Pipette className="w-3.5 h-3.5 text-amber-500" />
                <span>Selector de Color Libre (Spectrum)</span>
              </span>
              <button
                type="button"
                onClick={handleReset}
                title="Restablecer al color original"
                className="text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center space-x-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Revertir</span>
              </button>
            </div>

            <div className="flex items-center space-x-3">
              {/* Swatch circular con selector nativo de HTML5 */}
              <label 
                className="relative w-12 h-12 rounded-xl border-2 border-neutral-300 dark:border-neutral-700 cursor-pointer overflow-hidden shadow-xs hover:scale-105 active:scale-95 transition-transform flex items-center justify-center shrink-0"
                style={{ backgroundColor: currentColorHex }}
                title="Haz clic para abrir el selector de color completo"
              >
                <input
                  type="color"
                  value={currentColorHex.startsWith('#') && currentColorHex.length === 7 ? currentColorHex : '#2563eb'}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Pipette className="w-4 h-4 text-white drop-shadow-md pointer-events-none" />
              </label>

              {/* Input de código HEX editable */}
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                  Código Hexadecimal
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={hexInput}
                    onChange={handleHexInputChange}
                    placeholder="#2563EB"
                    maxLength={7}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-[#222222] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* PALETA RÁPIDA DE NOTION (10 COLORES PREDEFINIDOS) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                O elige un tono de la paleta rápida:
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {TAG_COLOR_OPTIONS.map((col) => {
                const isSelected = selectedColor === col.id || selectedColor === col.customHex;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleColorChange(col.id)}
                    className={`flex items-center space-x-2 px-2.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer border text-left ${
                      isSelected
                        ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold shadow-2xs ring-2 ring-neutral-900/10 dark:ring-white/10'
                        : 'border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-[#1b1b1b] text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full ${col.dotBg} shrink-0 ring-1 ring-black/10 dark:ring-white/20`}
                    />
                    <span className="truncate text-[11px]">{col.label.split('/')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pie con Botones Explícitos: Cancelar y Aceptar */}
        <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#222222] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleAceptar}
            disabled={guardando}
            className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {guardando ? (
              <span>Guardando...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Aceptar y Guardar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserColorPickerModal;
