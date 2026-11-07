import { SpecimenRecord } from '../types/specimen';

export const INITIAL_SPECIMENS: SpecimenRecord[] = [
  {
    id: 'cr-bio-2026-0042',
    catalogNumber: 'CAT. CR-BIO-2026-0042',
    scientificName: 'Isthmohyla nacientes',
    commonName: 'Rana de las Nacientes / Rana Cafetera / Nacientes Treefrog',
    taxonGroup: 'Amphibia',
    realm: 'Neotropical',
    collector: 'Ing. Carvajal V. & Colaboradores (Herpetología Santos)',
    collectionDate: '15 Febrero 2026',
    collectionTime: '20:30 CST',
    institutionCode: 'UCR-MZ / UNA',
    curationStatus: 'Verificada',
    darwinCoreSync: true,
    fieldFolio: 'Ficha Holotipo / Paratipo Folio #01-Santos',

    iucnStatus: {
      code: 'VU',
      label: 'Vulnerable (Endémica de Costa Rica)',
      trend: 'Microendémica / Sensible a Fuentes Hídricas',
    },
    citesStatus: {
      appendix: 'Endémica de Costa Rica',
      distribution: 'Microendémica de la Zona de los Santos (Tarrazú, Dota, León Cortés)',
    },

    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Amphibia',
      order: 'Anura',
      family: 'Hylidae',
      genus: 'Isthmohyla',
      species: 'nacientes',
      taxonId: 'LSID:urn:lsid:zoobank.org:act:2026-INAC',
    },

    heroImage: '/isthmohyla_nacientes.jpg',
    heroImageDescription: 'Fotografía científica auténtica de Isthmohyla nacientes (Rana de las Nacientes / Rana Cafetera) descubierta en la Zona de los Santos, Costa Rica.',

    bioacoustics: {
      title: 'Canto de Anuncio Ripario',
      callType: 'Vocalización Territorial / Reproductiva de Alta Frecuencia',
      dominantFrequencyRange: '3.4 - 4.6 kHz',
      durationSeconds: 18,
      audioPatternDescription: 'Pulsos agudos y rápidos de alta frecuencia emitidos para competir acústicamente sobre el ruido del agua corriente en nacientes.',
    },

    georeference: {
      latitude: 9.66250,
      longitude: -84.02220,
      latitudeDMS: '9°39\'45.0" N',
      longitudeDMS: '84°01\'20.0" W',
      datum: 'WGS84',
      accuracyMeters: 3.5,
      elevationMeters: 1650,
      locality: 'San Lorenzo de Tarrazú / Quebrada Las Nacientes, Zona de los Santos',
      province: 'San José, Costa Rica',
      conservationArea: 'Área de Conservación Central (ACC) / Cordillera de Talamanca',
      lifeZone: 'Bosque Pluvial Montano Bajo y Bosque Muy Húmedo Premontano',
      microhabitat: 'Follaje ribereño sobre nacientes de montaña y quebradas cristalinas adyacentes a cafetales de sombra',
    },

    morphometrics: {
      snoutVentLengthMm: 31.8,
      colorationAndAnatomy: 'Ranita de porte pequeño, longitud hocico-cloaca menor a 4 cm (machos adultos 28.0–32.5 mm, hembras 33.0–37.8 mm). Coloración dorsal verde metálico brillante uniforme con sutil punteado oscuro y piel finamente granular. Iris prominente de tono cobrizo-dorado a rojizo con fina reticulación negra y pupila horizontal. Vientre crema-blanquecino translúcido. Discos digitales moderadamente expandidos adaptados a la vegetación ribereña húmeda y rocas resbaladizas.',
      ethologyAndReproduction: 'Especie nocturna estrechamente vinculada a nacientes y quebradas de montaña con corriente limpia y oxigenada. Los machos cantan perchados sobre hojas de arbustos y helechos a baja altura (0.3 a 1.5 m) directamente sobre el curso del agua. Los renacuajos completan su metamorfosis en remansos pedregosos de aguas frías y oxigenadas.',
      courtshipAndMating: 'Cortejo es un llamado del macho constante y la hembra se acerca, no hay más datos en este momento de verificación científica.',
      interspecificRelations: 'Congénere de las ranas de montaña de Talamanca Isthmohyla rivularis e Isthmohyla tica, con las cuales fue confundida en colectas históricas de la década de 1960 hasta que análisis moleculares y bioacústicos en 2026 demostraron su independencia evolutiva. Comparte microhábitat ribereño con ranitas de hojarasca Craugastor podiciferus y Pristimantis cruentus. Es una especie bioindicadora clave de la pureza de las fuentes hídricas de la región.',
      confirmedScientificData: 'Descrita formalmente a inicios de 2026 en la revista científica Ichthyology & Herpetology por los investigadores Wagner Chaves-Acuña, Juan Abarca, Jonathan Navarro-Picado, Esteban Hidalgo-Mora, Marilyn Ureña-Chaves, Alejandro Valverde-Castillo, Gerardo Chaves, Federico Bolaños y Julián Faivovich. Especie endémica de Costa Rica redescubierta en San Lorenzo de Tarrazú en 2021 y validada mediante evidencia integrativa genética, morfológica y bioacústica.',
      sympatricSpecies: [],
    },

    additionalPhotos: [
      {
        id: 'photo-1',
        url: '/isthmohyla_nacientes.jpg',
        label: 'Ejemplar en Campo',
        description: 'Fotografía en vida de Isthmohyla nacientes sobre follaje de naciente en Los Santos.',
      },
      {
        id: 'photo-2',
        url: '/isthmohyla_nacientes_habitat.jpg',
        label: 'Naciente & Hábitat Ripario',
        description: 'Microhábitat de naciente y quebrada cristalina de montaña en la Zona de los Santos.',
      },
      {
        id: 'photo-3',
        url: '/isthmohyla_nacientes_eye_zoom.jpg',
        label: 'Detalle Ocular',
        description: 'Macro zoom de alta precisión y nitidez del ojo de Isthmohyla nacientes. Se aprecia el iris cobrizo-dorado metálico característico con reticulaciones oscuras dendríticas, pupila horizontal adaptada a baja luminosidad en quebradas y piel verde esmeralda con gránulos cutáneos húmedos.',
      },
      {
        id: 'photo-4',
        url: '/uploads/macho_tuerto_isthmohyla_propia.jpg',
        label: 'Hallazgo: Macho Tuerto',
        description: 'Hallazgo curioso en Santa María de Dota (Viernes 9): Macho adulto de Isthmohyla nacientes al que le falta un ojo (anoftalmia/cicatrización natural). Era el que cantaba con mayor potencia acústica a 45 cm del caudal.',
      },
    ],
    sightings: [],
  },
];
