/**
 * Cache Offline de Fotografías e Imágenes en Memoria Local (IndexedDB & CacheStorage)
 * Garantiza que en quebradas y montañas sin señal celular o internet,
 * todas las fotos del catálogo y avistamientos sigan cargando 100% offline.
 */

import { SpecimenRecord } from '../types/specimen';

const CACHE_NAME = 'biobitacora-media-v2';
const DB_NAME = 'BioBitacoraImagesDB';
const STORE_NAME = 'cachedImages';

interface CacheItem {
  url: string;
  blob: Blob;
  base64DataUrl?: string;
  cachedAt: number;
}

// Inicializa IndexedDB para almacenamiento masivo de imágenes
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Convierte un Blob en Base64 data URL
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Guarda una imagen en CacheStorage e IndexedDB
 */
export async function cacheSingleImage(url: string): Promise<boolean> {
  if (!url || url.startsWith('data:')) return true;

  try {
    // 1. Intentar en CacheStorage si está disponible
    if ('caches' in window) {
      try {
        const cache = await caches.open(CACHE_NAME);
        const match = await cache.match(url);
        if (!match) {
          await cache.add(url);
        }
      } catch (e) {
        // Ignorar si falla por CORS, continuar con fetch blob
      }
    }

    // 2. Fetch y guardar en IndexedDB
    const res = await fetch(url, { mode: 'cors' }).catch(() => null);
    if (!res || !res.ok) return false;

    const blob = await res.blob();
    const base64 = await blobToBase64(blob).catch(() => undefined);

    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const item: CacheItem = {
        url,
        blob,
        base64DataUrl: base64,
        cachedAt: Date.now(),
      };
      store.put(item);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn(`No se pudo cachear imagen ${url}:`, err);
    return false;
  }
}

/**
 * Guarda directamente datos en base64 o blob asociados a una URL en CacheStorage e IndexedDB
 */
export async function cacheSingleImageWithData(url: string, base64Data: string): Promise<boolean> {
  if (!url || !base64Data) return false;
  try {
    const clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const byteCharacters = atob(clean);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const mimeMatch = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const blob = new Blob([byteArray], { type: mimeType });

    // 1. Guardar en CacheStorage para el Service Worker
    if ('caches' in window) {
      try {
        const cache = await caches.open(CACHE_NAME);
        const response = new Response(blob, {
          headers: { 'Content-Type': mimeType, 'Content-Length': String(blob.size) },
        });
        await cache.put(url, response);
      } catch (e) {
        // Ignorar
      }
    }

    // 2. Guardar en IndexedDB
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const item: CacheItem = {
        url,
        blob,
        base64DataUrl: base64Data,
        cachedAt: Date.now(),
      };
      store.put(item);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('Error al cachear imagen con datos:', err);
    return false;
  }
}

/**
 * Guarda una fotografía tanto en caché local (IndexedDB) para visualización offline inmediata,
 * como en el servidor (/api/upload-photo) para persistencia permanente y sincronización multi-dispositivo.
 */
export async function saveImageOfflineAndServer(
  fileOrBase64: File | string,
  prefix: string = 'foto'
): Promise<string> {
  let base64String = '';
  let filename: string | undefined = undefined;

  if (typeof fileOrBase64 === 'string') {
    base64String = fileOrBase64;
  } else if (fileOrBase64 instanceof File) {
    filename = fileOrBase64.name;
    base64String = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBase64);
    });
  }

  if (!base64String) {
    throw new Error('No se pudo leer la imagen');
  }

  // Clave temporal local mientras se confirma servidor
  const localTempKey = `offline-${prefix}-${Date.now()}`;
  await cacheSingleImageWithData(localTempKey, base64String);

  const isMacho = prefix === 'macho_tuerto' || prefix.includes('macho') || (filename && filename.toLowerCase().includes('macho'));

  // Intentar subir de inmediato al servidor para sincronizar con todos los dispositivos
  try {
    const res = await fetch('/api/upload-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Data: base64String,
        filename,
        prefix,
      }),
    });
    const data = await res.json();
    if (data.success && data.url) {
      const permanentUrl = data.url;
      // Guardar en CacheStorage e IndexedDB bajo la URL permanente
      await cacheSingleImageWithData(permanentUrl, base64String);
      
      if (isMacho) {
        try {
          localStorage.setItem('bio_macho_tuerto_custom_photo', permanentUrl);
          await cacheSingleImageWithData('bio_macho_tuerto_custom_photo', base64String);
        } catch {}
      }

      return permanentUrl;
    }
  } catch (err) {
    console.warn('Servidor no disponible al subir foto, operando en modo offline de campo:', err);
  }

  // Si no hay internet o el servidor está temporalmente inaccesible, devolver base64
  // pero ya quedó asegurado en IndexedDB
  if (isMacho) {
    try {
      localStorage.setItem('bio_macho_tuerto_custom_photo', base64String);
      await cacheSingleImageWithData('bio_macho_tuerto_custom_photo', base64String);
    } catch {}
  }
  return base64String;
}

/**
 * Maneja fallos de carga en elementos <img> buscando la imagen en la caché IndexedDB
 */
export async function handleImageOfflineFallback(
  imgElement: HTMLImageElement,
  fallbackUrl?: string
): Promise<void> {
  const currentSrc = imgElement.src || '';

  // 1. Intentar recuperar de IndexedDB o CacheStorage
  try {
    const cached = await getCachedImageUrl(currentSrc);
    if (cached && cached !== currentSrc) {
      imgElement.src = cached;
      return;
    }
    const pathOnly = new URL(currentSrc, window.location.origin).pathname;
    const cachedPath = await getCachedImageUrl(pathOnly);
    if (cachedPath && cachedPath !== currentSrc) {
      imgElement.src = cachedPath;
      return;
    }
    const filename = pathOnly.split('/').pop();
    if (filename) {
      const cachedFile = await getCachedImageUrl(filename);
      if (cachedFile && cachedFile !== currentSrc) {
        imgElement.src = cachedFile;
        return;
      }
    }
  } catch {}

  // 2. Proteger la fotografía del macho tuerto: NUNCA colocar la foto de la portada
  const isMacho =
    currentSrc.includes('macho') ||
    currentSrc.includes('un_ojo') ||
    imgElement.getAttribute('data-is-macho') === 'true' ||
    imgElement.alt?.toLowerCase().includes('macho tuerto') ||
    fallbackUrl?.includes('macho');

  if (isMacho) {
    try {
      const customMacho = localStorage.getItem('bio_macho_tuerto_custom_photo');
      if (customMacho) {
        const cachedCustom = await getCachedImageUrl(customMacho);
        if (cachedCustom) {
          imgElement.src = cachedCustom;
          return;
        }
        if (customMacho.startsWith('data:') || customMacho.startsWith('/uploads/')) {
          imgElement.src = customMacho;
          return;
        }
      }
    } catch {}
    imgElement.src = '/hallazgo_macho_un_ojo.jpg';
    return;
  }

  // 3. Si se especificó un fallback distinto a la portada de Isthmohyla
  if (fallbackUrl && fallbackUrl !== '/isthmohyla_nacientes.jpg') {
    imgElement.src = fallbackUrl;
    return;
  }

  // 4. Si la imagen pertenece específicamente a Isthmohyla nacientes
  if (imgElement.alt?.toLowerCase().includes('isthmohyla') || currentSrc.includes('isthmohyla')) {
    imgElement.src = '/isthmohyla_nacientes.jpg';
    return;
  }

  // 5. Placeholder svg biológico neutral para otras especies o fotografías de usuario
  imgElement.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%230f382a"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%236cf8bb" font-family="sans-serif" font-size="15" font-weight="bold">Fotografía en Almacenamiento Local</text><text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" fill="%23a5d0bc" font-family="sans-serif" font-size="12">Sincronizado sin conexión</text></svg>`;
}

/**
 * Obtiene la imagen de la caché local (IndexedDB o CacheStorage)
 */
export async function getCachedImageUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  try {
    const db = await openDb();
    const urlsToTry = [
      url,
      new URL(url, window.location.origin).pathname,
      url.split('/').pop() || '',
    ].filter(Boolean);

    // Si es macho tuerto, intentar también la clave personalizada
    if (url.includes('macho') || url.includes('un_ojo')) {
      urlsToTry.push('bio_macho_tuerto_custom_photo');
      const customKey = typeof window !== 'undefined' ? localStorage.getItem('bio_macho_tuerto_custom_photo') : null;
      if (customKey) {
        urlsToTry.unshift(customKey);
        urlsToTry.unshift(new URL(customKey, window.location.origin).pathname);
      }
    }

    for (const testUrl of urlsToTry) {
      const item: CacheItem | null = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(testUrl);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (item) {
        if (item.base64DataUrl) return item.base64DataUrl;
        if (item.blob) return URL.createObjectURL(item.blob);
      }
    }

    // Intentar CacheStorage
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      for (const testUrl of urlsToTry) {
        const match = await cache.match(testUrl);
        if (match) {
          const blob = await match.blob();
          return URL.createObjectURL(blob);
        }
      }
    }
  } catch (e) {
    // Fallback silencioso a la URL remota
  }
  return null;
}

/**
 * Extrae todas las URLs de imágenes de los especímenes
 */
export function extractAllImageUrls(specimens: SpecimenRecord[]): string[] {
  const urls = new Set<string>();
  specimens.forEach((spec) => {
    if (spec.heroImage && !spec.heroImage.startsWith('data:')) {
      urls.add(spec.heroImage);
    }
    spec.additionalPhotos?.forEach((p) => {
      if (p.url && !p.url.startsWith('data:')) {
        urls.add(p.url);
      }
    });
    spec.sightings?.forEach((s) => {
      if (s.curiousFindingPhoto && !s.curiousFindingPhoto.startsWith('data:')) {
        urls.add(s.curiousFindingPhoto);
      }
      s.photoUrls?.forEach((u) => {
        if (u && !u.startsWith('data:')) urls.add(u);
      });
    });
  });
  return Array.from(urls);
}

/**
 * Cachea todas las fotografías de los especímenes en segundo plano
 */
export async function cacheAllSpecimensMedia(
  specimens: SpecimenRecord[],
  onProgress?: (cached: number, total: number) => void
): Promise<{ cached: number; total: number }> {
  const urls = extractAllImageUrls(specimens);
  let count = 0;

  for (const url of urls) {
    await cacheSingleImage(url);
    count++;
    onProgress?.(count, urls.length);
  }

  return { cached: count, total: urls.length };
}

/**
 * Cuenta cuántas imágenes están cacheadas actualmente
 */
export async function getCachedImagesCount(): Promise<number> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}
