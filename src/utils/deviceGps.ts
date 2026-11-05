import { detectLocationAndLifeZone, formatCoordinatesDMS } from '../data/costaRicaData';

export interface DeviceGpsResult {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  altitudeMeters: number;
  latitudeDMS: string;
  longitudeDMS: string;
  combinedDMS: string;
  locality: string;
  province: string;
  lifeZone: string;
  timestamp: string;
}

/**
 * Capture high-accuracy satellite GPS coordinates from the device
 * Uses navigator.geolocation with enableHighAccuracy: true
 */
export async function captureDeviceGps(): Promise<DeviceGpsResult> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    throw new Error('Este dispositivo o navegador no soporta geolocalización GPS.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracyMeters = Math.round((position.coords.accuracy || 5) * 10) / 10;
        const altitudeRaw = position.coords.altitude;

        const dms = formatCoordinatesDMS(lat, lng);
        const detected = detectLocationAndLifeZone(
          lat,
          lng,
          altitudeRaw !== null && altitudeRaw !== undefined ? Math.round(altitudeRaw) : undefined
        );

        const result: DeviceGpsResult = {
          latitude: lat,
          longitude: lng,
          accuracyMeters,
          altitudeMeters:
            altitudeRaw !== null && altitudeRaw !== undefined && altitudeRaw > 0
              ? Math.round(altitudeRaw)
              : detected.elevation,
          latitudeDMS: dms.latDMS,
          longitudeDMS: dms.lngDMS,
          combinedDMS: dms.combined,
          locality: detected.locality,
          province: detected.province,
          lifeZone: detected.lifeZone,
          timestamp: new Date().toISOString(),
        };

        resolve(result);
      },
      (error) => {
        let msg = 'No se pudo obtener la ubicación GPS.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = 'Permiso de ubicación denegado en este dispositivo. Por favor permite el acceso al GPS en tu navegador o ajustes del móvil.';
            break;
          case error.POSITION_UNAVAILABLE:
            msg = 'Señal de GPS no disponible en este momento. Verifica que el GPS de tu móvil esté encendido.';
            break;
          case error.TIMEOUT:
            msg = 'Tiempo de espera agotado buscando señal satelital GPS. Inténtalo de nuevo al aire libre.';
            break;
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}
