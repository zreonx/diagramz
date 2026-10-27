/**
 * User Custom Assets & Icons Storage and Processing
 *
 * Enables diagram authors to upload custom SVG vector icons and raster images
 * (PNG, JPG, WebP, GIF), store them in local storage, place them on the canvas,
 * drag-and-drop from the OS or Library Panel, and paste from the OS clipboard.
 */

export interface CustomAssetItem {
  id: string;
  name: string;
  type: 'image' | 'svg';
  src: string;
  width: number;
  height: number;
  createdAt: number;
  svgMarkup?: string;
}

const STORAGE_KEY = 'diagramz_custom_assets';
const MAX_STORED_ASSETS = 60;
const MAX_DIMENSION_PX = 800; // Max stored raster dimension to conserve localStorage
const DEFAULT_CANVAS_DIM = 160; // Default size on canvas placement

/**
 * Loads custom assets from localStorage.
 */
export function loadCustomAssets(): CustomAssetItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is CustomAssetItem => (
        item &&
        typeof item.id === 'string' &&
        typeof item.src === 'string' &&
        typeof item.name === 'string'
      ));
    }
  } catch (err) {
    console.warn('Failed to load custom assets from localStorage:', err);
  }
  return [];
}

/**
 * Saves a new or updated custom asset into localStorage.
 */
export function saveCustomAsset(asset: CustomAssetItem): CustomAssetItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const current = loadCustomAssets();
    // Remove if already exists with same id or identical src
    const filtered = current.filter((a) => a.id !== asset.id && a.src !== asset.src);
    // Prepend new asset
    const updated = [asset, ...filtered].slice(0, MAX_STORED_ASSETS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to persist custom asset to localStorage:', err);
    // If quota exceeded, try evicting older items
    try {
      const current = loadCustomAssets();
      const pruned = [asset, ...current.slice(0, Math.min(10, current.length))];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
      return pruned;
    } catch {
      // Return what we have in memory
      return [asset];
    }
  }
}

/**
 * Deletes a custom asset by ID.
 */
export function deleteCustomAsset(id: string): CustomAssetItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const current = loadCustomAssets();
    const updated = current.filter((a) => a.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to delete custom asset:', err);
    return [];
  }
}

/**
 * Clears all custom assets.
 */
export function clearCustomAssets(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear custom assets:', err);
  }
}

/**
 * Calculates canvas placement dimensions preserving natural aspect ratio.
 */
export function calculateFitDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxBoundingSize = DEFAULT_CANVAS_DIM
): { width: number; height: number } {
  const w = naturalWidth > 0 ? naturalWidth : maxBoundingSize;
  const h = naturalHeight > 0 ? naturalHeight : maxBoundingSize;

  if (w <= maxBoundingSize && h <= maxBoundingSize) {
    return { width: Math.max(48, Math.round(w)), height: Math.max(48, Math.round(h)) };
  }

  const ratio = w / h;
  if (ratio >= 1) {
    const width = maxBoundingSize;
    const height = Math.max(32, Math.round(maxBoundingSize / ratio));
    return { width, height };
  } else {
    const height = maxBoundingSize;
    const width = Math.max(32, Math.round(maxBoundingSize * ratio));
    return { width, height };
  }
}

/**
 * Reads and optimizes an image file (SVG or raster) into a CustomAssetItem.
 */
export async function processImageFile(file: File): Promise<CustomAssetItem> {
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  const baseName = file.name.replace(/\.[^/.]+$/, '') || 'Custom Asset';
  const id = `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  if (isSvg) {
    const text = await file.text();
    // Parse SVG dimensions if available
    let natW = 120;
    let natH = 120;
    try {
      const matchVb = text.match(/viewBox=["']\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*["']/i);
      if (matchVb) {
        natW = Math.abs(parseFloat(matchVb[3])) || 120;
        natH = Math.abs(parseFloat(matchVb[4])) || 120;
      } else {
        const matchW = text.match(/width=["']([0-9.-]+)/i);
        const matchH = text.match(/height=["']([0-9.-]+)/i);
        if (matchW) natW = Math.abs(parseFloat(matchW[1])) || 120;
        if (matchH) natH = Math.abs(parseFloat(matchH[1])) || 120;
      }
    } catch {
      natW = 120;
      natH = 120;
    }

    const { width, height } = calculateFitDimensions(natW, natH, 140);
    // Encode as data URL for universal img / svg rendering
    const encodedSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;

    return {
      id,
      name: baseName,
      type: 'svg',
      src: encodedSvg,
      svgMarkup: text,
      width,
      height,
      createdAt: Date.now(),
    };
  }

  // Raster image processing: PNG, JPG, WebP, GIF
  return new Promise<CustomAssetItem>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        const natW = img.naturalWidth || 160;
        const natH = img.naturalHeight || 160;
        const { width, height } = calculateFitDimensions(natW, natH, 160);

        // If very large image, downscale for localStorage optimization
        if (natW > MAX_DIMENSION_PX || natH > MAX_DIMENSION_PX) {
          try {
            const canvas = document.createElement('canvas');
            const scale = Math.min(MAX_DIMENSION_PX / natW, MAX_DIMENSION_PX / natH);
            canvas.width = Math.round(natW * scale);
            canvas.height = Math.round(natH * scale);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const optimizedDataUrl = canvas.toDataURL(file.type || 'image/png', 0.9);
              resolve({
                id,
                name: baseName,
                type: 'image',
                src: optimizedDataUrl,
                width,
                height,
                createdAt: Date.now(),
              });
              return;
            }
          } catch {
            // fallback to rawDataUrl
          }
        }

        resolve({
          id,
          name: baseName,
          type: 'image',
          src: rawDataUrl,
          width,
          height,
          createdAt: Date.now(),
        });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}
