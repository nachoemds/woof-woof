// src/components/RichTextEditor.tsx
import React, { useRef, useEffect, useState } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Palette, 
  Highlighter, 
  List, 
  ListOrdered, 
  Link2, 
  RemoveFormatting, 
  Type,
  ChevronDown,
  ImagePlus,
  Loader2
} from 'lucide-react';
import { uploadTicketImage } from '../lib/imageStorage';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
  storageFolder?: string;
  onSubmitShortcut?: () => void;
}

const TEXT_COLORS = [
  { name: 'Negro / Blanco', color: '#171717' },
  { name: 'Gris oscuro', color: '#525252' },
  { name: 'Azul', color: '#2563eb' },
  { name: 'Púrpura', color: '#7c3aed' },
  { name: 'Verde', color: '#16a34a' },
  { name: 'Naranja', color: '#ea580c' },
  { name: 'Rojo', color: '#dc2626' }
];

const BG_COLORS = [
  { name: 'Sin fondo', color: 'transparent' },
  { name: 'Amarillo', color: '#fef08a' },
  { name: 'Verde claro', color: '#bbf7d0' },
  { name: 'Azul claro', color: '#bfdbfe' },
  { name: 'Rosa claro', color: '#fbcfe8' },
  { name: 'Morado claro', color: '#e9d5ff' },
  { name: 'Naranja claro', color: '#fed7aa' }
];

const FONT_SIZES = [
  { label: 'Pequeño', size: '1', style: '11px' },
  { label: 'Normal', size: '3', style: '13px' },
  { label: 'Grande', size: '5', style: '16px' },
  { label: 'Enorme', size: '7', style: '20px' }
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Escribe tu mensaje...',
  minHeight = '100px',
  disabled = false,
  storageFolder = 'general',
  onSubmitShortcut
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Sincronizar contenido inicial o externo sin perder la posición del cursor
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      if (!value) {
        editorRef.current.innerHTML = '';
      } else if (editorRef.current.innerHTML === '') {
        editorRef.current.innerHTML = value;
      }
    }
  }, [value]);

  const emitChange = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      if (html === '<p><br></p>' || html === '<br>') {
        onChange('');
      } else {
        onChange(html);
      }
    }
  };

  const executeCommand = (command: string, arg?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
  };

  const handleApplyColor = (color: string) => {
    executeCommand('foreColor', color);
    setShowTextColorPicker(false);
  };

  const handleApplyBgColor = (color: string) => {
    executeCommand('hiliteColor', color);
    setShowBgColorPicker(false);
  };

  const handleApplyFontSize = (size: string) => {
    executeCommand('fontSize', size);
    setShowFontSizePicker(false);
  };

  const handleOpenLinkPopover = () => {
    if (disabled) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
    setShowTextColorPicker(false);
    setShowBgColorPicker(false);
    setShowFontSizePicker(false);
    setShowLinkPopover((prev) => !prev);
  };

  const handleConfirmInsertLink = () => {
    const raw = linkUrlInput.trim();
    if (!raw) {
      setShowLinkPopover(false);
      return;
    }
    const finalUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    editorRef.current?.focus();
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
    }
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      document.execCommand('createLink', false, finalUrl);
    } else {
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${finalUrl}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">${finalUrl}</a>&nbsp;`
      );
    }
    emitChange();
    setLinkUrlInput('');
    setShowLinkPopover(false);
  };

  // Procesa, comprime (~100KB) y sube una o más imágenes insertándolas en el editor
  const processAndInsertImages = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0 || disabled) return;

    setUploadingImage(true);
    try {
      for (const file of imageFiles) {
        const uploaded = await uploadTicketImage(file, storageFolder);
        if (editorRef.current) {
          editorRef.current.focus();
          const imgHtml = `<br><img src="${uploaded.url}" alt="Referencia adjunta" style="max-height:240px; max-width:100%; width:auto; border-radius:8px; margin:6px 0; border:1px solid #d4d4d4; cursor:zoom-in; display:block;" /><br>`;
          document.execCommand('insertHTML', false, imgHtml);
          emitChange();
        }
      }
    } catch (err) {
      console.error('Error subiendo imagen adjunta:', err);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      await processAndInsertImages(files);
    }
  };

  // Soporte para pegar capturas de pantalla directo con Ctrl+V / Cmd+V
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const pastedImages: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) pastedImages.push(file);
      }
    }

    if (pastedImages.length > 0) {
      e.preventDefault();
      await processAndInsertImages(pastedImages);
    }
  };

  // Soporte para arrastrar y soltar imágenes dentro del editor
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    setIsDraggingOver(false);
    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      e.preventDefault();
      await processAndInsertImages(imageFiles);
    }
  };

  return (
    <div
      className={`border rounded-lg bg-white dark:bg-[#1a1a1a] overflow-hidden focus-within:ring-1 focus-within:ring-neutral-900 dark:focus-within:ring-neutral-400 focus-within:border-neutral-900 dark:focus-within:border-neutral-400 transition shadow-2xs ${
        isDraggingOver
          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10'
          : 'border-neutral-300 dark:border-neutral-700'
      }`}
    >
      {/* Input oculto para seleccionar imágenes JPG/PNG/WebP */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      {/* Barra de Herramientas Estilo Gmail */}
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-neutral-50/90 dark:bg-[#252525] border-b border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs select-none">
          
          {/* Selector de Tamaño de Letra */}
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setShowFontSizePicker(!showFontSizePicker);
                setShowTextColorPicker(false);
                setShowBgColorPicker(false);
              }}
              className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition cursor-pointer text-[11px] font-medium"
              title="Tamaño de letra"
            >
              <Type className="w-3.5 h-3.5" />
              <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
            </button>

            {showFontSizePicker && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#252525] border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 z-30 min-w-[110px] text-xs">
                {FONT_SIZES.map((fs) => (
                  <button
                    key={fs.size}
                    type="button"
                    onClick={() => handleApplyFontSize(fs.size)}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition text-neutral-800 dark:text-neutral-200"
                    style={{ fontSize: fs.style }}
                  >
                    {fs.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

          {/* Negrita */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => executeCommand('bold')}
            className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition cursor-pointer text-neutral-700 dark:text-neutral-300"
            title="Negrita (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Cursiva */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => executeCommand('italic')}
            className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition cursor-pointer text-neutral-700 dark:text-neutral-300"
            title="Cursiva (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          {/* Subrayado */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => executeCommand('underline')}
            className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition cursor-pointer text-neutral-700 dark:text-neutral-300"
            title="Subrayado (Ctrl+U)"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

          {/* Color de Texto */}
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setShowTextColorPicker(!showTextColorPicker);
                setShowBgColorPicker(false);
                setShowFontSizePicker(false);
              }}
              className="flex items-center space-x-0.5 p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition cursor-pointer text-neutral-700 dark:text-neutral-300"
              title="Color del texto"
            >
              <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
            </button>

            {showTextColorPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#252525] border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg p-2 z-30 grid grid-cols-4 gap-1.5 min-w-[140px]">
                {TEXT_COLORS.map((tc) => (
                  <button
                    key={tc.color}
                    type="button"
                    onClick={() => handleApplyColor(tc.color)}
                    className="w-6 h-6 rounded-full border border-neutral-300 dark:border-neutral-600 flex items-center justify-center hover:scale-110 transition cursor-pointer"
                    style={{ backgroundColor: tc.color }}
                    title={tc.name}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Color de Fondo / Resaltador */}
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setShowBgColorPicker(!showBgColorPicker);
                setShowTextColorPicker(false);
                setShowFontSizePicker(false);
              }}
              className="flex items-center space-x-0.5 p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition cursor-pointer text-neutral-700 dark:text-neutral-300"
              title="Color de fondo (Resaltar)"
            >
              <Highlighter className="w-3.5 h-3.5 text-amber-500" />
              <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
            </button>

            {showBgColorPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#252525] border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg p-2 z-30 grid grid-cols-4 gap-1.5 min-w-[140px]">
                {BG_COLORS.map((bc) => (
                  <button
                    key={bc.name}
                    type="button"
                    onClick={() => handleApplyBgColor(bc.color)}
                    className="w-6 h-6 rounded border border-neutral-300 dark:border-neutral-600 flex items-center justify-center hover:scale-110 transition cursor-pointer text-[10px]"
                    style={{ backgroundColor: bc.color }}
                    title={bc.name}
                  >
                    {bc.color === 'transparent' ? '✕' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

          {/* Lista con Viñetas */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => executeCommand('insertUnorderedList')}
            className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition cursor-pointer text-neutral-700 dark:text-neutral-300"
            title="Lista con viñetas"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          {/* Lista Numerada */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => executeCommand('insertOrderedList')}
            className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition cursor-pointer text-neutral-700 dark:text-neutral-300"
            title="Lista numerada"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          {/* Enlace con popover inline (sin window.prompt) */}
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              onClick={handleOpenLinkPopover}
              className={`p-1.5 rounded transition cursor-pointer ${
                showLinkPopover
                  ? 'bg-neutral-200 dark:bg-neutral-700 text-blue-600 dark:text-blue-400'
                  : 'hover:bg-neutral-200/70 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
              }`}
              title="Insertar enlace"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>

            {showLinkPopover && (
              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#252525] border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl p-2 z-30 flex items-center space-x-1.5 min-w-[250px]">
                <input
                  type="text"
                  value={linkUrlInput}
                  onChange={(e) => setLinkUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmInsertLink();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setShowLinkPopover(false);
                    }
                  }}
                  placeholder="https://drive.google.com/..."
                  autoFocus
                  className="flex-1 px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-[#1a1a1a] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleConfirmInsertLink}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded transition cursor-pointer shrink-0"
                >
                  Insertar
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-700 mx-1" />

          {/* Botón Adjuntar Imagen / Miniatura (JPG, PNG, Captura) */}
          <button
            type="button"
            disabled={disabled || uploadingImage}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 transition cursor-pointer text-[11px] font-semibold"
            title="Adjuntar imagen de referencia o miniatura (También puedes pegar con Ctrl+V / Cmd+V)"
          >
            {uploadingImage ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Comprimiendo...</span>
              </>
            ) : (
              <>
                <ImagePlus className="w-3.5 h-3.5" />
                <span>Adjuntar JPG/PNG</span>
              </>
            )}
          </button>

          {/* Limpiar formato */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => executeCommand('removeFormat')}
            className="p-1.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition cursor-pointer text-neutral-700 dark:text-neutral-300 ml-auto"
            title="Eliminar formato"
          >
            <RemoveFormatting className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Área Editable estilo Gmail / Notion con soporte de Pegar y Arrastrar Imágenes */}
      <div
        className="relative"
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDraggingOver) setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
      >
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={emitChange}
          onBlur={emitChange}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && onSubmitShortcut) {
              e.preventDefault();
              emitChange();
              onSubmitShortcut();
            }
          }}
          style={{ minHeight }}
          className="p-3 text-xs text-neutral-800 dark:text-neutral-100 focus:outline-none overflow-y-auto leading-relaxed rich-editor-content"
        />

        {/* Placeholder flotante cuando está vacío */}
        {(!value || value.trim() === '') && (
          <div 
            onClick={() => editorRef.current?.focus()}
            className="absolute left-3 top-3 text-xs text-neutral-400 dark:text-neutral-500 pointer-events-none select-none"
          >
            {placeholder}
          </div>
        )}
      </div>

      {/* Barra Inferior estilo Gmail con botón para alternar barra de formato (A) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-50/50 dark:bg-[#202020] border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-400 dark:text-neutral-500">
        <button
          type="button"
          onClick={() => setShowToolbar(!showToolbar)}
          className={`flex items-center space-x-1 px-1.5 py-0.5 rounded transition cursor-pointer ${
            showToolbar ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold' : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 text-neutral-500 dark:text-neutral-400'
          }`}
          title="Opciones de formato"
        >
          <span className="underline font-bold text-xs">A</span>
          <span className="text-[10px]">{showToolbar ? 'Ocultar barra' : 'Formato'}</span>
        </button>

        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
          💡 Puedes pegar capturas con <strong>Ctrl+V / Cmd+V</strong> o arrastrar JPG/PNG
        </span>
      </div>

    </div>
  );
};
