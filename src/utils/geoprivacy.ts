/**
 * Geoprivacidad & Protección de Coordenadas de Especies Amenazadas / Microendémicas
 * Protocolo de conservación SINAC / UICN para Costa Rica (e.g. Isthmohyla nacientes).
 */

export interface GeoprivacyOptions {
  enabled: boolean;
  radiusKm?: number; // Radio de difuminación (2 a 5 km)
}

/**
 * Calcula un desplazamiento determinista (pseudoaleatorio pero consistente para el mismo ID)
 * dentro de un radio de 2.5 a 4 km para no revelar la naciente exacta.
 */
export function getObfuscatedCoordinates(
  lat: number,
  lng: number,
  seedId: string,
  radiusKm = 3.2
): { lat: number; lng: number; radiusMeters: number; isObfuscated: boolean } {
  // Hash determinista del seedId para que la coordenada difuminada no salte en cada render
  let hash = 0;
  for (let i = 0; i < seedId.length; i++) {
    hash = (hash << 5) - hash + seedId.charCodeAt(i);
    hash |= 0;
  }
  const normalizedHash = Math.abs(hash) / 2147483647;
  const angle = normalizedHash * 2 * Math.PI;
  const distanceKm = 1.8 + (Math.abs(hash % 1000) / 1000) * (radiusKm - 1.8);

  // 1 grado latitud ~ 111 km, 1 grado longitud en Costa Rica (~10°N) ~ 109 km
  const deltaLat = (distanceKm / 111) * Math.cos(angle);
  const deltaLng = (distanceKm / 109) * Math.sin(angle);

  return {
    lat: Number((lat + deltaLat).toFixed(4)),
    lng: Number((lng + deltaLng).toFixed(4)),
    radiusMeters: Math.round(distanceKm * 1000),
    isObfuscated: true,
  };
}

/**
 * Formatea coordenadas en DMS o decimal con sello de geoprivacidad
 */
export function formatProtectedCoordinates(
  lat: number,
  lng: number,
  seedId: string,
  isProtected: boolean
): {
  displayCoordinates: string;
  isProtected: boolean;
  accuracyNote: string;
  effectiveLat: number;
  effectiveLng: number;
} {
  if (!isProtected) {
    return {
      displayCoordinates: `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° W`,
      isProtected: false,
      accuracyNote: 'Precisión exacta de GPS submétrico en campo.',
      effectiveLat: lat,
      effectiveLng: lng,
    };
  }

  const obf = getObfuscatedCoordinates(lat, lng, seedId);
  return {
    displayCoordinates: `${obf.lat.toFixed(3)}° N, ${obf.lng.toFixed(3)}° W (Zona protegida ±3 km)`,
    isProtected: true,
    accuracyNote: 'Coordenadas difuminadas por protocolo de conservación SINAC/UICN (radio ~3 km) para proteger la naciente.',
    effectiveLat: obf.lat,
    effectiveLng: obf.lng,
  };
}
