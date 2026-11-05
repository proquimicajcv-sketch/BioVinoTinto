import { SpecimenRecord } from '../types/specimen';
import { getObfuscatedCoordinates } from './geoprivacy';

export function formatDarwinCoreRecord(specimen: SpecimenRecord, obfuscateCoordinates = false) {
  const sightings = specimen.sightings || [];
  const individualCount =
    sightings.length > 0
      ? sightings.reduce((acc, s) => acc + (s.individualsCount || s.count || 0), 0)
      : 0;

  let lat = specimen.georeference.latitude;
  let lng = specimen.georeference.longitude;
  let uncertainty = specimen.georeference.accuracyMeters;
  let informationWithheld = '';

  if (obfuscateCoordinates) {
    const obf = getObfuscatedCoordinates(lat, lng, specimen.id, 3.5);
    lat = obf.lat;
    lng = obf.lng;
    uncertainty = Math.max(uncertainty, obf.radiusMeters);
    informationWithheld =
      'Coordenadas geográficas difuminadas a radio de 3.5 km por protocolo de geoprivacidad SINAC/UICN para proteger naciente de especie amenazada o microendémica.';
  }

  return {
    occurrenceID: `urn:catalog:${specimen.institutionCode}:${specimen.catalogNumber.replace('CAT. ', '')}`,
    basisOfRecord: 'HumanObservation',
    scientificName: specimen.scientificName,
    vernacularName: specimen.commonName,
    individualCount,
    kingdom: specimen.taxonomy.kingdom,
    phylum: specimen.taxonomy.phylum,
    class: specimen.taxonomy.class,
    order: specimen.taxonomy.order,
    family: specimen.taxonomy.family,
    genus: specimen.taxonomy.genus,
    specificEpithet: specimen.taxonomy.species,
    taxonRank: 'species',
    taxonomicStatus: 'accepted',
    taxonID: specimen.taxonomy.taxonId || '',
    country: 'Costa Rica',
    countryCode: 'CR',
    stateProvince: specimen.georeference.province,
    locality: specimen.georeference.locality,
    decimalLatitude: lat,
    decimalLongitude: lng,
    verbatimCoordinates: obfuscateCoordinates
      ? `${lat}° N, ${lng}° W (Zona difuminada)`
      : `${specimen.georeference.latitudeDMS}, ${specimen.georeference.longitudeDMS}`,
    coordinateUncertaintyInMeters: uncertainty,
    geodeticDatum: specimen.georeference.datum,
    minimumElevationInMeters: specimen.georeference.elevationMeters,
    habitat: specimen.georeference.microhabitat,
    eventDate: specimen.collectionDate,
    eventTime: specimen.collectionTime,
    recordedBy: specimen.collector,
    identifiedBy: specimen.collector,
    institutionCode: specimen.institutionCode,
    catalogNumber: specimen.catalogNumber,
    fieldNumber: specimen.fieldFolio,
    iucnRedListCategory: specimen.iucnStatus.code,
    citesAppendix: specimen.citesStatus.appendix,
    lifeStage: 'Adult',
    sex: 'Male',
    informationWithheld: informationWithheld || undefined,
    dynamicProperties: JSON.stringify({
      snoutVentLengthMm: specimen.morphometrics.snoutVentLengthMm,
      coloration: specimen.morphometrics.colorationAndAnatomy,
      ethology: specimen.morphometrics.ethologyAndReproduction,
      sympatricCount: specimen.morphometrics.sympatricSpecies.length,
      conservationArea: specimen.georeference.conservationArea,
      holdridgeLifeZone: specimen.georeference.lifeZone,
    }),
  };
}

export function exportDarwinCoreJson(specimen: SpecimenRecord) {
  const dwc = formatDarwinCoreRecord(specimen);
  const jsonStr = JSON.stringify(dwc, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${specimen.catalogNumber.replace(/[^a-zA-Z0-9-]/g, '_')}_DwC.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportDarwinCoreCsv(specimens: SpecimenRecord[], obfuscateCoordinates = false) {
  if (specimens.length === 0) return;
  const records = specimens.map((s) => formatDarwinCoreRecord(s, obfuscateCoordinates));
  const headers = Object.keys(records[0]) as (keyof typeof records[0])[];

  const csvRows = [
    headers.join(','),
    ...records.map((r) =>
      headers
        .map((h) => {
          const val = r[h] !== undefined ? String(r[h]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    ),
  ];

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BioBitacora_CR_DarwinCore_Export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
