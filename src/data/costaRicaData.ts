export interface CostaRicaHotspot {
  id: string;
  name: string;
  subLocation: string;
  province: string;
  latitude: number;
  longitude: number;
  elevation: number;
  lifeZone: string;
  conservationArea: string;
  description: string;
}

export const COSTA_RICA_CENTER = {
  latitude: 9.7489,
  longitude: -83.7534,
  zoom: 8,
};

export const COSTA_RICA_BOUNDS = {
  north: 11.22,
  south: 8.03,
  west: -85.95,
  east: -82.55,
};

export const CONSERVATION_AREAS_CR = [
  { code: 'ACTo', name: 'Área de Conservación Tortuguero', region: 'Caribe Norte' },
  { code: 'ACAHN', name: 'Área de Conservación Arenal Huetar Norte', region: 'Norte' },
  { code: 'ACC', name: 'Área de Conservación Cordillera Central', region: 'Valle Central / Volcanes' },
  { code: 'ACAT', name: 'Área de Conservación Arenal Tempisque', region: 'Arenal / Guanacaste' },
  { code: 'ACOPAC', name: 'Área de Conservación Pacífico Central', region: 'Pacífico Central' },
  { code: 'ACOSA', name: 'Área de Conservación Osa', region: 'Pacífico Sur / Osa' },
  { code: 'ACLAC', name: 'Área de Conservación La Amistad Caribe', region: 'Talamanca / Limón' },
  { code: 'ACLAP', name: 'Área de Conservación La Amistad Pacífico', region: 'Talamanca / Buenos Aires' },
  { code: 'ACT', name: 'Área de Conservación Tempisque', region: 'Península de Nicoya' },
  { code: 'ACG', name: 'Área de Conservación Guanacaste', region: 'Santa Rosa / Rincón' },
];

export const COSTA_RICA_HOTSPOTS: CostaRicaHotspot[] = [
  {
    id: 'la-selva',
    name: 'Estación Biológica La Selva',
    subLocation: 'Sarapiquí, Heredia',
    province: 'Heredia',
    latitude: 10.4304,
    longitude: -84.0095,
    elevation: 68,
    lifeZone: 'Bosque Tropical Húmedo (bmh-T)',
    conservationArea: 'Área de Conservación Arenal Huetar Norte (ACAHN)',
    description: 'Estación de la OET líder mundial en investigación de ecología tropical de tierras bajas del Caribe.',
  },
  {
    id: 'monteverde',
    name: 'Reserva Biológica Bosque Nuboso Monteverde',
    subLocation: 'Sierra de Tilarán, Puntarenas',
    province: 'Puntarenas',
    latitude: 10.3025,
    longitude: -84.7958,
    elevation: 1440,
    lifeZone: 'Bosque Nuboso Premontano Muy Húmedo (bp-PM)',
    conservationArea: 'Área de Conservación Arenal Tempisque (ACAT)',
    description: 'Santuario de epífitas, anfibios de montaña y hábitat primordial del Quetzal resplandeciente.',
  },
  {
    id: 'corcovado-sirena',
    name: 'Estación Sirena, Parque Nacional Corcovado',
    subLocation: 'Península de Osa, Puntarenas',
    province: 'Puntarenas',
    latitude: 8.4809,
    longitude: -83.5901,
    elevation: 12,
    lifeZone: 'Bosque Tropical Muy Húmedo (bmh-T)',
    conservationArea: 'Área de Conservación Osa (ACOSA)',
    description: 'Considerado el lugar biológicamente más intenso del planeta según National Geographic.',
  },
  {
    id: 'tortuguero',
    name: 'Parque Nacional Tortuguero',
    subLocation: 'Canales de Tortuguero, Limón',
    province: 'Limón',
    latitude: 10.5414,
    longitude: -83.5042,
    elevation: 5,
    lifeZone: 'Bosque Húmedo Tropical / Humedales Costeros',
    conservationArea: 'Área de Conservación Tortuguero (ACTo)',
    description: 'Sistema laberíntico de canales fluviales y sitio primario de anidación de tortugas verdes.',
  },
  {
    id: 'san-gerardo-dota',
    name: 'Valle de San Gerardo de Dota / Los Quetzales',
    subLocation: 'Cordillera de Talamanca, San José',
    province: 'San José',
    latitude: 9.5532,
    longitude: -83.8051,
    elevation: 2200,
    lifeZone: 'Bosque Pluvial Montano Bajo (bp-MB)',
    conservationArea: 'Área de Conservación Pacífico Central (ACOPAC)',
    description: 'Valle de robledales de alta montaña cubierto de musgos y bromelias.',
  },
  {
    id: 'manuel-antonio',
    name: 'Parque Nacional Manuel Antonio',
    subLocation: 'Quepos, Puntarenas',
    province: 'Puntarenas',
    latitude: 9.3892,
    longitude: -84.1432,
    elevation: 25,
    lifeZone: 'Bosque Tropical Húmedo Transición a Seco',
    conservationArea: 'Área de Conservación Pacífico Central (ACOPAC)',
    description: 'Interfase bosque lluvioso y arrecifes costeros con alta densidad de monos y perezosos.',
  },
  {
    id: 'zona-los-santos',
    name: 'Zona de los Santos (San Marcos, Tarrazú / Dota)',
    subLocation: 'Nacientes de los Santos, Cordillera de Talamanca',
    province: 'San José',
    latitude: 9.6608,
    longitude: -84.0205,
    elevation: 1650,
    lifeZone: 'Bosque Pluvial Montano Bajo (bp-MB)',
    conservationArea: 'Área de Conservación Pacífico Central (ACOPAC)',
    description: 'Hábitat montano de nacientes cristalinas, cafetales de altura y localidad tipo de Isthmohyla nacientes.',
  },
  {
    id: 'cahuita',
    name: 'Parque Nacional Cahuita',
    subLocation: 'Talamanca, Limón',
    province: 'Limón',
    latitude: 9.7368,
    longitude: -82.8427,
    elevation: 4,
    lifeZone: 'Bosque Costero Tropical Húmedo',
    conservationArea: 'Área de Conservación La Amistad Caribe (ACLAC)',
    description: 'Pantano de manglar y arrecifes coralinos vivos en el Caribe Sur.',
  },
  {
    id: 'volcan-poas',
    name: 'Parque Nacional Volcán Poás',
    subLocation: 'Alajuela, Cordillera Volcánica Central',
    province: 'Alajuela',
    latitude: 10.1983,
    longitude: -84.2306,
    elevation: 2708,
    lifeZone: 'Bosque Muy Húmedo Montano (bmh-M)',
    conservationArea: 'Área de Conservación Cordillera Central (ACC)',
    description: 'Bosque achaparrado enano y cráter activo con fumarolas de azufre.',
  },
  {
    id: 'palo-verde',
    name: 'Parque Nacional Palo Verde',
    subLocation: 'Cuenca Baja Río Tempisque, Guanacaste',
    province: 'Guanacaste',
    latitude: 10.3541,
    longitude: -85.3488,
    elevation: 10,
    lifeZone: 'Bosque Tropical Seco (bs-T)',
    conservationArea: 'Área de Conservación Arenal Tempisque (ACAT)',
    description: 'Humedal de importancia Ramsar vital para cientos de especies de aves migratorias y acuáticas.',
  },
  {
    id: 'tapanti',
    name: 'Parque Nacional Tapantí - Macizo de la Muerte',
    subLocation: 'Cuenca del Río Grande de Orosi, Cartago',
    province: 'Cartago',
    latitude: 9.7612,
    longitude: -83.7845,
    elevation: 1600,
    lifeZone: 'Bosque Pluvial Montano Bajo (bp-MB)',
    conservationArea: 'Área de Conservación La Amistad Pacífico (ACLAP)',
    description: 'Una de las zonas más lluviosas del país con nacientes de ríos cristalinos y alta riqueza de anfibios.',
  },
  {
    id: 'braulio-carrillo',
    name: 'Parque Nacional Braulio Carrillo',
    subLocation: 'Paso de La Palma / Quebrada González, Heredia/San José',
    province: 'Heredia',
    latitude: 10.1583,
    longitude: -83.9744,
    elevation: 1100,
    lifeZone: 'Bosque Pluvial Premontano (bp-P)',
    conservationArea: 'Área de Conservación Cordillera Central (ACC)',
    description: 'Extenso corredor biológico selvático que protege las nacientes del Caribe Central y cuencas metropolitanas.',
  },
  {
    id: 'las-cruces-san-vito',
    name: 'Estación Biológica Las Cruces / Jardín Wilson',
    subLocation: 'San Vito de Coto Brus, Puntarenas',
    province: 'Puntarenas',
    latitude: 8.7853,
    longitude: -82.9592,
    elevation: 1200,
    lifeZone: 'Bosque Muy Húmedo Premontano (bmh-P)',
    conservationArea: 'Área de Conservación La Amistad Pacífico (ACLAP)',
    description: 'Santuario de la OET para la conservación de la flora endémica y aves del Pacífico Sur de Costa Rica.',
  },
  {
    id: 'santa-rosa',
    name: 'Parque Nacional Santa Rosa',
    subLocation: 'Sector Murciélago / Bahía Santa Elena, Guanacaste',
    province: 'Guanacaste',
    latitude: 10.8389,
    longitude: -85.6178,
    elevation: 290,
    lifeZone: 'Bosque Tropical Seco (bs-T)',
    conservationArea: 'Área de Conservación Guanacaste (ACG)',
    description: 'El remanente más grande y mejor conservado de bosque seco mesoamericano con jaguares y tortugas lora.',
  },
  {
    id: 'chirripo',
    name: 'Parque Nacional Chirripó',
    subLocation: 'San Gerardo de Rivas, Cordillera de Talamanca',
    province: 'San José',
    latitude: 9.4842,
    longitude: -83.4886,
    elevation: 3200,
    lifeZone: 'Páramo Subalpino (p-SA)',
    conservationArea: 'Área de Conservación La Amistad Pacífico (ACLAP)',
    description: 'Cumbre más alta de Costa Rica (3.820 msnm) con lagunas de origen glaciar y vegetación de frailejones y chusqueas.',
  },
  {
    id: 'valle-central-san-jose',
    name: 'Valle Central (San José - San Pedro - Curridabat)',
    subLocation: 'Cuenca Alta Río Virilla, Valle Central',
    province: 'San José',
    latitude: 9.9333,
    longitude: -84.0833,
    elevation: 1160,
    lifeZone: 'Bosque Húmedo Premontano (bh-P)',
    conservationArea: 'Área de Conservación Cordillera Central (ACC)',
    description: 'Interfase urbana-periurbana de cafetales y ríos montanos del Valle Central de Costa Rica.',
  },
];

export interface HoldridgeLifeZone {
  code: string;
  name: string;
  altitudinalBelt: string;
  elevationRange: string;
  typicalRegions: string;
}

export const HOLDRIDGE_LIFE_ZONES_CR: HoldridgeLifeZone[] = [
  {
    code: 'bmh-T',
    name: 'Bosque Muy Húmedo Tropical (bmh-T)',
    altitudinalBelt: 'Basal (Tierras Bajas)',
    elevationRange: '0 - 700 msnm',
    typicalRegions: 'Sarapiquí, Tortuguero, Península de Osa, Golfo Dulce, Caribe Sur',
  },
  {
    code: 'bh-T',
    name: 'Bosque Húmedo Tropical (bh-T)',
    altitudinalBelt: 'Basal (Tierras Bajas)',
    elevationRange: '0 - 600 msnm',
    typicalRegions: 'Pacífico Central, Quepos, Manuel Antonio, Dominical, Carara',
  },
  {
    code: 'bs-T',
    name: 'Bosque Seco Tropical (bs-T)',
    altitudinalBelt: 'Basal (Tierras Bajas)',
    elevationRange: '0 - 700 msnm',
    typicalRegions: 'Guanacaste, Península de Nicoya, Cuenca del Tempisque, Santa Rosa, Palo Verde',
  },
  {
    code: 'bp-T',
    name: 'Bosque Pluvial Tropical (bp-T)',
    altitudinalBelt: 'Basal (Tierras Bajas)',
    elevationRange: '0 - 700 msnm',
    typicalRegions: 'Faldas orientales del Caribe de altísima precipitación (>5000 mm anuales)',
  },
  {
    code: 'bh-P',
    name: 'Bosque Húmedo Premontano (bh-P)',
    altitudinalBelt: 'Premontano',
    elevationRange: '700 - 1400 msnm',
    typicalRegions: 'Valle Central (San José, Heredia, Alajuela, Atenas)',
  },
  {
    code: 'bmh-P',
    name: 'Bosque Muy Húmedo Premontano (bmh-P)',
    altitudinalBelt: 'Premontano',
    elevationRange: '700 - 1400 msnm',
    typicalRegions: 'Turrialba, San Vito de Coto Brus, Puriscal, Ciudad Quesada',
  },
  {
    code: 'bp-P',
    name: 'Bosque Pluvial Premontano / Bosque Nuboso (bp-P)',
    altitudinalBelt: 'Premontano',
    elevationRange: '700 - 1500 msnm',
    typicalRegions: 'Monteverde, Reserva Biológica Alberto Manuel Brenes (San Ramón), Bajos del Toro',
  },
  {
    code: 'bh-MB',
    name: 'Bosque Húmedo Montano Bajo (bh-MB)',
    altitudinalBelt: 'Montano Bajo',
    elevationRange: '1400 - 2400 msnm',
    typicalRegions: 'Valle de El Guarco, Cartago, Ochomogo',
  },
  {
    code: 'bmh-MB',
    name: 'Bosque Muy Húmedo Montano Bajo (bmh-MB)',
    altitudinalBelt: 'Montano Bajo',
    elevationRange: '1400 - 2500 msnm',
    typicalRegions: 'Faldas medias de Volcanes Poás e Irazú, Tapantí, Vara Blanca',
  },
  {
    code: 'bp-MB',
    name: 'Bosque Pluvial Montano Bajo (bp-MB)',
    altitudinalBelt: 'Montano Bajo (Robledales)',
    elevationRange: '1400 - 2600 msnm',
    typicalRegions: 'San Gerardo de Dota, Parque Nacional Los Quetzales, Cordillera de Talamanca',
  },
  {
    code: 'bmh-M',
    name: 'Bosque Muy Húmedo Montano (bmh-M)',
    altitudinalBelt: 'Montano',
    elevationRange: '2500 - 3100 msnm',
    typicalRegions: 'Cumbres volcánicas del Macizo Poás, Barva e Irazú',
  },
  {
    code: 'bp-M',
    name: 'Bosque Pluvial Montano (bp-M)',
    altitudinalBelt: 'Montano',
    elevationRange: '2500 - 3200 msnm',
    typicalRegions: 'Macizo de la Muerte, Villa Mills, San Gerardo alto',
  },
  {
    code: 'p-SA',
    name: 'Páramo Subalpino (p-SA)',
    altitudinalBelt: 'Subalpino',
    elevationRange: '3000 - 3820 msnm',
    typicalRegions: 'Cerro Chirripó, Cerro Buena Vista, Cerro Kamuk, Macizo de la Muerte',
  },
];

/**
 * Predicts the Holdridge Life Zone according to elevation and geographical coordinates
 */
export function estimateHoldridgeZone(elevation: number, lat: number, lng: number): HoldridgeLifeZone {
  // Paramo
  if (elevation >= 3000) {
    return HOLDRIDGE_LIFE_ZONES_CR.find((z) => z.code === 'p-SA')!;
  }
  // Montano
  if (elevation >= 2500) {
    return lng < -83.8
      ? HOLDRIDGE_LIFE_ZONES_CR.find((z) => z.code === 'bmh-M')!
      : HOLDRIDGE_LIFE_ZONES_CR.find((z) => z.code === 'bp-M')!;
  }
  // Montano Bajo
  if (elevation >= 1400) {
    if (lat < 9.7 && lng > -83.9) {
      return HOLDRIDGE_LIFE_ZONES_CR.find((z) => z.code === 'bp-MB')!; // Talamanca / Dota
    }
    return HOLDRIDGE_LIFE_ZONES_CR.find((z) => z.code === 'bmh-MB')!;
  }
  // Premontano
  if (elevation >= 700) {
    if (lat > 10.1 && lng < -84.6) {
      return HOLDRIDGE_LIFE_ZONES_CR.find((z) => z.code === 'bp-P')!; // Monteverde / Tilarán
    }
    if (lng > -84.2 && lng < -83.9 && lat > 9.8 && lat < 10.05) {
      return HOLDRIDGE_LIFE_ZONES_CR.find((z) => z.code === 'bh-P')!; // Central Valley
    }
    return HOLDRIDGE_LIFE_ZONES_CR.find((z) => z.code === 'bmh-P')!;
  }
  // Basal / Lowlands
  // Northwest Pacific (Guanacaste) is dry
  if (lat > 10.0 && lng < -85.0) {
    return HOLDRIDGE_LIFE_ZONES_CR.find((z) => z.code === 'bs-T')!; // Guanacaste Dry Forest
  }
  // Central Pacific transition
  if (lat < 10.0 && lat > 9.2 && lng < -84.0 && lng > -85.0) {
    return HOLDRIDGE_LIFE_ZONES_CR.find((z) => z.code === 'bh-T')!; // Manuel Antonio / Carara
  }
  // Caribbean & Osa very humid
  return HOLDRIDGE_LIFE_ZONES_CR.find((z) => z.code === 'bmh-T')!;
}

/**
 * Converts decimal coordinates to scientific Degrees Minutes Seconds (DMS) string
 */
export function formatCoordinatesDMS(lat: number, lng: number): { latDMS: string; lngDMS: string; combined: string } {
  const formatDMS = (value: number, isLat: boolean): string => {
    const absolute = Math.abs(value);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
    const direction = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${degrees}°${minutes}'${seconds}" ${direction}`;
  };

  const latDMS = formatDMS(lat, true);
  const lngDMS = formatDMS(lng, false);

  return {
    latDMS,
    lngDMS,
    combined: `${latDMS}, ${lngDMS}`,
  };
}

/**
 * Checks if a coordinate is within Costa Rica geographical bounds
 */
export function isWithinCostaRica(lat: number, lng: number): boolean {
  return (
    lat >= COSTA_RICA_BOUNDS.south &&
    lat <= COSTA_RICA_BOUNDS.north &&
    lng >= COSTA_RICA_BOUNDS.west &&
    lng <= COSTA_RICA_BOUNDS.east
  );
}

/**
 * Finds the nearest Costa Rican biological station / hotspot for a coordinate
 */
export function findNearestHotspot(lat: number, lng: number): CostaRicaHotspot {
  let minDistance = Infinity;
  let nearest = COSTA_RICA_HOTSPOTS[0];

  for (const hotspot of COSTA_RICA_HOTSPOTS) {
    const dLat = hotspot.latitude - lat;
    const dLng = hotspot.longitude - lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistance) {
      minDistance = distSq;
      nearest = hotspot;
    }
  }

  return nearest;
}

export interface DetectedLocationResult {
  locality: string;
  subLocation: string;
  province: string;
  elevation: number;
  lifeZone: string;
  conservationArea: string;
  lat: number;
  lng: number;
  dms: string;
}

/**
 * Automagically detects the locality, province, elevation and Holdridge Life Zone
 * from geographic coordinates anywhere in Costa Rica.
 */
export function detectLocationAndLifeZone(lat: number, lng: number, elevationOverride?: number): DetectedLocationResult {
  const nearest = findNearestHotspot(lat, lng);
  const elev = typeof elevationOverride === 'number' && elevationOverride > 0 ? elevationOverride : nearest.elevation;
  const holdridge = estimateHoldridgeZone(elev, lat, lng);
  const dms = formatCoordinatesDMS(lat, lng);

  return {
    locality: nearest.name,
    subLocation: nearest.subLocation,
    province: `${nearest.province}, Costa Rica`,
    elevation: elev,
    lifeZone: holdridge.name,
    conservationArea: nearest.conservationArea,
    lat,
    lng,
    dms: dms.combined,
  };
}
