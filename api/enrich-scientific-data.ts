import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Método no permitido' });
    return;
  }

  try {
    const { scientificName, commonName, taxonGroup } = req.body;
    const queryTerm = (scientificName || commonName || '').trim();

    if (!queryTerm) {
      res.status(400).json({
        success: false,
        error: 'Debe proporcionar al menos el nombre común o el nombre científico de la especie.',
      });
      return;
    }

    const promptText = `
Eres un biólogo taxónomo y ecólogo investigador especialista en la biodiversidad de Costa Rica y el Neotrópico (UCR, OET, SINAC, INBio, Smithsonian).

El usuario necesita identificar y completar 100% la ficha científica para este organismo:
- Nombre científico proporcionado: "${scientificName || 'No indicado'}"
- Nombre común proporcionado: "${commonName || 'No indicado'}"
- Grupo taxonómico aproximado: "${taxonGroup || 'No indicado'}"

Tu tarea:
1. Si el usuario dio solo el nombre común (ej. "Rana de ojos rojos", "Quetzal", "Jaguar", "Yigüirro", "Guaria morada"), determina con exactitud su nombre científico binomial válido para Costa Rica, su jerarquía taxonómica completa y grupo taxonómico.
2. Si el usuario dio solo el nombre científico (ej. "Agalychnis callidryas", "Pharomachrus mocinno"), determina su nombre común en español utilizado en Costa Rica y en inglés.
3. Si dio ambos, valida la taxonomía y completa todos los detalles morfológicos, etológicos y reproductivos.
4. Genera datos exhaustivos y fidedignos confirmados en investigaciones de campo en Costa Rica (UCR / OET La Selva, Monteverde, Sirena, Palo Verde, etc.).

Responde ÚNICAMENTE con un JSON válido con la siguiente estructura:
{
  "scientificName": "Género epíteto",
  "commonName": "Nombre común en Costa Rica / Nombre en inglés",
  "taxonGroup": "Amphibia" | "Aves" | "Mammalia" | "Insecta" | "Reptilia" | "Plantae",
  "taxonomy": {
    "kingdom": "Animalia" o "Plantae",
    "phylum": "Chordata",
    "class": "Amphibia",
    "order": "Anura",
    "family": "Hylidae",
    "genus": "Agalychnis",
    "species": "callidryas"
  },
  "morphometrics": {
    "snoutVentLengthMm": 58.0,
    "totalLengthMm": 58.0,
    "weightGrams": 15.0
  },
  "colorationAndAnatomy": "Morfología diagnóstica, detalles cromáticos, adaptaciones esqueléticas, tegumento, plumaje o escamas, dimorfismo sexual.",
  "ethologyAndReproduction": "Patrones etológicos, ritmos circadianos, estrategias de forrajeo y termorregulación en su hábitat costarricense.",
  "courtshipAndMating": "Rituales de cortejo, señales visuales/bioacústicas de atracción, amplexo/cópula, modo reproductivo, fecundación, cuidados parentales y anidación/ovoposición.",
  "interspecificRelations": "Territorialidad intraespecífica, relaciones con especies simpátricas, principales depredadores en Costa Rica, mecanismos de defensa (aposematismo, camuflaje, toxinas, tanatosis).",
  "confirmedScientificData": "Datos y descubrimientos científicos confirmados por investigaciones biológicas de campo en Costa Rica (citas de estaciones como La Selva OET, Monteverde, Sirena o universidades UCR/UNA).",
  "suggestedHoldridgeZone": "Nombre completo de la zona de vida de Holdridge en Costa Rica (ej. Bosque Muy Húmedo Tropical (bmh-T))",
  "microhabitat": "Microhábitat exacto donde suele registrarse (follaje, arroyo, estrato arbóreo, hojarasca)",
  "elevationMeters": 68,
  "hasBioacoustics": true,
  "bioacoustics": {
    "title": "Canto de Anuncio o Llamado",
    "callType": "Vocalización Territorial / Reproductiva",
    "dominantFrequencyRange": "1.8 - 2.4 kHz",
    "audioPatternDescription": "Descripción de la pauta bioacústica o sonido emitido"
  }
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const textOutput = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(textOutput);
    } catch {
      const cleaned = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error en enrich-scientific-data:', error);
    res.status(500).json({ success: false, error: error?.message || 'Error al enriquecer datos científicos' });
  }
}
