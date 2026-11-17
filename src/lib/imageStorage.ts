// src/lib/imageStorage.ts
/**
 * Servicio de Compresión Inteligente y Almacenamiento de Imágenes (Supabase Storage)
 * - Comprime automáticamente cualquier JPG/PNG/Captura en el navegador (~100 KB) antes de subir.
 * - Sube al bucket 'ticket-attachments' de Supabase Storage (funciona 100% en Vercel y localhost).
 * - Permite al Super Admin borrar imágenes/miniaturas de un ticket o de todos los tickets resueltos
 *   para liberar espacio en el servidor SIN perder el ticket, ni su brief escrito, ni sus links de Drive.
 */

import { supabase, saveLocalCustomTitle } from './supabase';
import { Ticket } from '../types';

export const STORAGE_BUCKET = 'ticket-attachments';

export interface UploadedImageResult {
  url: string;
  storagePath?: string;
  sizeKB: number;
}

/**
 * Comprime y redimensiona una imagen en el navegador usando HTML5 Canvas
 * (Máximo 1600px de lado mayor, formato WebP o JPEG al 80% de calidad -> ~90-140 KB)
 */
export async function compressImageFile(
  file: File | Blob,
  maxDimension = 1600,
  quality = 0.8
): Promise<{ blob: Blob; ext: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo inicializar el compresor de imagen.'));
        return;
      }

      // Fondo blanco por si es un PNG transparente convertido
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Intentar WebP primero (más liviano), fallback a JPEG
      canvas.toBlob(
        (webpBlob) => {
          if (webpBlob) {
            resolve({ blob: webpBlob, ext: 'webp', mime: 'image/webp' });
          } else {
            canvas.toBlob(
              (jpegBlob) => {
                if (jpegBlob) {
                  resolve({ blob: jpegBlob, ext: 'jpg', mime: 'image/jpeg' });
                } else {
                  reject(new Error('Error al comprimir la imagen.'));
                }
              },
              'image/jpeg',
              quality
            );
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('El archivo seleccionado no es una imagen válida.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Convierte un Blob pequeño en DataURL como respaldo si el bucket aún no fue creado en Supabase
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Comprime y sube una imagen al Bucket 'ticket-attachments' de Supabase Storage
 */
export async function uploadTicketImage(
  file: File | Blob,
  folder: string = 'general'
): Promise<UploadedImageResult> {
  // 1. Comprimir en el navegador antes de subir
  const { blob, ext, mime } = await compressImageFile(file, 1600, 0.8);
  const sizeKB = Math.max(1, Math.round(blob.size / 1024));

  const randomId = Math.random().toString(36).substring(2, 9);
  const cleanFolder = String(folder).replace(/[^a-zA-Z0-9_-]/g, '_');
  const storagePath = `tickets/${cleanFolder}/${Date.now()}_${randomId}.${ext}`;

  // 2. Subir a Supabase Storage
  try {
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, blob, {
        contentType: mime,
        cacheControl: '31536000',
        upsert: false,
      });

    if (!uploadError) {
      const { data: publicData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      if (publicData?.publicUrl) {
        return {
          url: publicData.publicUrl,
          storagePath,
          sizeKB,
        };
      }
    } else {
      console.warn(
        'Aviso subiendo a Supabase Storage (usando respaldo comprimido):',
        uploadError.message
      );
    }
  } catch (err) {
    console.warn('Fallback local para imagen adjunta:', err);
  }

  // 3. Fallback ultra-comprimido si aún no corrieron el SQL del Bucket en Supabase
  const fallbackCompressed = await compressImageFile(file, 960, 0.68);
  const dataUrl = await blobToDataUrl(fallbackCompressed.blob);
  return {
    url: dataUrl,
    sizeKB: Math.max(1, Math.round(fallbackCompressed.blob.size / 1024)),
  };
}

/**
 * Detecta si un bloque HTML contiene imágenes adjuntas (<img ...>)
 */
export function htmlHasImages(html?: string | null): boolean {
  if (!html) return false;
  return /<img\b[^>]*>/i.test(html);
}

/**
 * Cuenta cuántas imágenes (<img ...>) hay en un bloque HTML
 */
export function countImagesInHtml(html?: string | null): number {
  if (!html) return 0;
  const matches = html.match(/<img\b[^>]*>/gi);
  return matches ? matches.length : 0;
}

/**
 * Extrae las rutas internas de Supabase Storage desde las URLs de un HTML
 * para poder eliminarlas físicamente del servidor cuando el Super Admin depura un ticket
 */
export function extractStoragePathsFromHtml(html?: string | null): string[] {
  if (!html) return [];
  const paths: string[] = [];
  const imgRegex = /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1] || '';
    const idx = src.indexOf(marker);
    if (idx !== -1) {
      const rawPath = decodeURIComponent(src.substring(idx + marker.length).split('?')[0]);
      if (rawPath) paths.push(rawPath);
    }
  }
  return paths;
}

/**
 * Reemplaza todas las etiquetas <img> por una etiqueta limpia de auditoría indicando que
 * la imagen o miniatura fue depurada para liberar espacio, conservando todo el texto y links.
 */
export function stripImagesFromHtmlWithNotice(html: string): string {
  if (!html) return html;
  const noticeHtml =
    '<div style="margin:6px 0;padding:6px 10px;border-radius:8px;background:#f5f5f5;border:1px dashed #d4d4d4;color:#737373;font-size:11px;display:inline-block;">🖼️ <em>Imagen / miniatura eliminada por Administración para liberar espacio</em></div>';
  return html.replace(/<img\b[^>]*>/gi, noticeHtml);
}

/**
 * Elimina todas las imágenes (referencias del Brief + miniaturas en Comentarios) de UN ticket específico,
 * borrando los archivos físicos de Supabase Storage pero conservando el ticket, textos y links de Drive.
 */
export async function purgeImagesFromSingleTicket(
  ticket: Ticket
): Promise<{ removedCount: number }> {
  let removedCount = 0;
  const storagePathsToDelete: string[] = [];
  const ticketId = ticket.id;

  // 1. Revisar y limpiar el Brief del ticket si tiene imágenes
  if (ticket.brief && htmlHasImages(ticket.brief)) {
    const count = countImagesInHtml(ticket.brief);
    removedCount += count;
    storagePathsToDelete.push(...extractStoragePathsFromHtml(ticket.brief));

    const cleanBrief = stripImagesFromHtmlWithNotice(ticket.brief);
    await supabase
      .from('tickets')
      .update({ brief: cleanBrief })
      .eq('id', ticketId);
  }

  // 2. Revisar y limpiar los Comentarios del ticket que tengan imágenes o miniaturas
  try {
    const { data: comments } = await supabase
      .from('comentarios')
      .select('*')
      .eq('ticket_id', ticketId);

    if (Array.isArray(comments)) {
      for (const comm of comments) {
        const rawMsg = comm.mensaje || comm.contenido || '';
        if (htmlHasImages(rawMsg)) {
          removedCount += countImagesInHtml(rawMsg);
          storagePathsToDelete.push(...extractStoragePathsFromHtml(rawMsg));

          const cleanMsg = stripImagesFromHtmlWithNotice(rawMsg);
          const updatePayload: Record<string, string> = {};
          if ('mensaje' in comm) updatePayload.mensaje = cleanMsg;
          if ('contenido' in comm) updatePayload.contenido = cleanMsg;

          await supabase
            .from('comentarios')
            .update(updatePayload)
            .eq('id', comm.id);
        }
      }
    }
  } catch (err) {
    console.warn('Aviso limpiando imágenes en comentarios:', err);
  }

  // 3. Borrar los archivos físicos en el Bucket de Supabase Storage para liberar los MB reales
  if (storagePathsToDelete.length > 0) {
    try {
      const uniquePaths = Array.from(new Set(storagePathsToDelete));
      await supabase.storage.from(STORAGE_BUCKET).remove(uniquePaths);
    } catch (err) {
      console.warn('Aviso removiendo archivos del bucket:', err);
    }
  }

  // Ignorar warning de import no usado
  void saveLocalCustomTitle;

  return { removedCount };
}

/**
 * Depuración masiva para Super Admin:
 * Elimina las imágenes y miniaturas de todos los tickets RESUELTOS (o aprobados),
 * conservando intacto el historial de tickets, briefs de texto, comentarios y links de Google Drive.
 */
export async function purgeImagesFromResolvedTickets(
  tickets: Ticket[]
): Promise<{ ticketsCleaned: number; imagesRemoved: number; updatedTicketsMap: Record<string, string> }> {
  const resueltos = tickets.filter((t) => {
    const est = (t.estado || '').toLowerCase();
    return est.includes('resuelto') || est.includes('aprob');
  });

  let ticketsCleaned = 0;
  let imagesRemoved = 0;
  const updatedTicketsMap: Record<string, string> = {};

  for (const t of resueltos) {
    const { removedCount } = await purgeImagesFromSingleTicket(t);
    if (removedCount > 0) {
      ticketsCleaned += 1;
      imagesRemoved += removedCount;
      if (t.brief && htmlHasImages(t.brief)) {
        updatedTicketsMap[String(t.id)] = stripImagesFromHtmlWithNotice(t.brief);
      }
    }
  }

  return { ticketsCleaned, imagesRemoved, updatedTicketsMap };
}
