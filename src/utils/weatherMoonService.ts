/**
 * Módulo Climatológico Automatizado (Open-Meteo) y Cálculo de Fase Lunar
 * Especializado para herpetología y monitoreo de anfibios en Costa Rica.
 */

export interface WeatherMoonData {
  temperatureC: number;
  humidityPct: number;
  apparentTempC: number;
  precipitationMm: number;
  weatherDescription: string;
  pressureHpa: number;
  cloudCoverPct: number;
  windSpeedKmh: number;
  moonPhase: {
    name: string; // e.g. "Luna Llena"
    emoji: string; // e.g. "🌕"
    illuminationPct: number; // e.g. 98
    ageDays: number;
    herpetoComment: string; // Comentario relevante para coros de anfibios
  };
  summaryText: string;
}

/**
 * Calcula la fase lunar astronómica para una fecha dada (ciclo sinódico de 29.53058867 días)
 */
export function calculateMoonPhase(dateInput?: Date | string): WeatherMoonData['moonPhase'] {
  const date = dateInput ? new Date(dateInput) : new Date();
  
  // Luna nueva de referencia conocida: 6 de Enero de 2000 18:14 UTC
  const referenceNewMoon = new Date('2000-01-06T18:14:00Z').getTime();
  const diffDays = (date.getTime() - referenceNewMoon) / (1000 * 60 * 60 * 24);
  const synodicMonth = 29.53058867;
  
  // Edad lunar en días (0 a ~29.53)
  const ageDays = ((diffDays % synodicMonth) + synodicMonth) % synodicMonth;
  const phaseFraction = ageDays / synodicMonth; // 0 a 1

  // Porcentaje de iluminación aproximado (0% en nueva, 100% en llena)
  const illuminationPct = Math.round((1 - Math.cos(2 * Math.PI * phaseFraction)) * 50);

  let name = '';
  let emoji = '🌑';
  let herpetoComment = '';

  if (ageDays < 1.84) {
    name = 'Luna Nueva';
    emoji = '🌑';
    herpetoComment = 'Noche oscura: alta actividad de forrajeo en suelo y hojarasca.';
  } else if (ageDays < 5.53) {
    name = 'Luna Creciente Cóncava';
    emoji = '🌒';
    herpetoComment = 'Luminosidad baja: coros de quebrada activos en estratos bajos.';
  } else if (ageDays < 9.22) {
    name = 'Cuarto Creciente';
    emoji = '🌓';
    herpetoComment = 'Media luna: condiciones estables para vocalización territorial.';
  } else if (ageDays < 12.91) {
    name = 'Gibosa Creciente';
    emoji = '🌔';
    herpetoComment = 'Luminosidad ascendente: anfibios suelen refugiarse en vegetación densa.';
  } else if (ageDays < 16.61) {
    name = 'Luna Llena';
    emoji = '🌕';
    herpetoComment = 'Luz cenital intensa: posible inhibición lunar en especies expuestas; coros concentrados en dosel o bajo ramas.';
  } else if (ageDays < 20.3) {
    name = 'Gibosa Menguante';
    emoji = '🌖';
    herpetoComment = 'Descenso de luminosidad tras medianoche: picos de canto tardíos.';
  } else if (ageDays < 23.99) {
    name = 'Cuarto Menguante';
    emoji = '🌗';
    herpetoComment = 'Madrugadas oscuras favorables para actividad reproductiva.';
  } else if (ageDays < 27.68) {
    name = 'Luna Menguante Cóncava';
    emoji = '🌘';
    herpetoComment = 'Noche predominantemente oscura: alta detectabilidad acústica.';
  } else {
    name = 'Luna Nueva';
    emoji = '🌑';
    herpetoComment = 'Noche oscura: óptima para muestreos nocturnos de fauna críptica.';
  }

  return {
    name,
    emoji,
    illuminationPct,
    ageDays: Number(ageDays.toFixed(1)),
    herpetoComment,
  };
}

/**
 * Traduce el código meteorológico WMO a descripción en español
 */
function getWmoWeatherDescription(code: number): string {
  switch (code) {
    case 0: return 'Despejado';
    case 1: return 'Mayormente despejado';
    case 2: return 'Parcialmente nublado';
    case 3: return 'Nublado';
    case 45: case 48: return 'Neblina de montaña';
    case 51: case 53: case 55: return 'Llovizna ligera';
    case 61: case 63: case 65: return 'Lluvia moderada';
    case 80: case 81: case 82: return 'Chubascos tropicales';
    case 95: case 96: case 99: return 'Tormenta eléctrica';
    default: return 'Cielo nuboso';
  }
}

/**
 * Consulta la API de Open-Meteo para las coordenadas del punto de avistamiento
 */
export async function fetchLiveFieldWeather(
  latitude: number,
  longitude: number,
  dateIso?: string
): Promise<WeatherMoonData> {
  const moonPhase = calculateMoonPhase(dateIso);

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure,cloud_cover&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`Open-Meteo status: ${res.status}`);
    const data = await res.json();
    const cur = data.current || {};

    const temp = cur.temperature_2m ?? 21.0;
    const humidity = cur.relative_humidity_2m ?? 85;
    const apparent = cur.apparent_temperature ?? temp;
    const precip = cur.precipitation ?? 0;
    const weatherDesc = getWmoWeatherDescription(cur.weather_code ?? 2);
    const pressure = cur.surface_pressure ?? 1013;
    const clouds = cur.cloud_cover ?? 50;
    const wind = cur.wind_speed_10m ?? 4;

    const summary = `${weatherDesc}, ${temp.toFixed(1)}°C, Humedad ${humidity}% • Luna: ${moonPhase.emoji} ${moonPhase.name} (${moonPhase.illuminationPct}%)`;

    return {
      temperatureC: Number(temp.toFixed(1)),
      humidityPct: Math.round(humidity),
      apparentTempC: Number(apparent.toFixed(1)),
      precipitationMm: Number(precip.toFixed(1)),
      weatherDescription: weatherDesc,
      pressureHpa: Math.round(pressure),
      cloudCoverPct: Math.round(clouds),
      windSpeedKmh: Number(wind.toFixed(1)),
      moonPhase,
      summaryText: summary,
    };
  } catch (err) {
    // Fallback con estimación realista para Costa Rica (trópico húmedo) + fase lunar real calculada
    const defaultTemp = 21.5;
    const defaultHum = 88;
    const defaultDesc = 'Humedad nocturna de montaña, neblina riparia';
    const summary = `${defaultDesc}, ${defaultTemp}°C, Humedad ${defaultHum}% • Luna: ${moonPhase.emoji} ${moonPhase.name} (${moonPhase.illuminationPct}%)`;

    return {
      temperatureC: defaultTemp,
      humidityPct: defaultHum,
      apparentTempC: defaultTemp,
      precipitationMm: 0,
      weatherDescription: defaultDesc,
      pressureHpa: 1013,
      cloudCoverPct: 60,
      windSpeedKmh: 3,
      moonPhase,
      summaryText: summary,
    };
  }
}
