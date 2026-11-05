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

async function getImagePart(imageUrl?: string, imageBase64?: string): Promise<{ mimeType: string; data: string } | null> {
  if (imageBase64) {
    const matches = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      return {
        mimeType: matches[1],
        data: matches[2],
      };
    }
    return {
      mimeType: 'image/jpeg',
      data: imageBase64,
    };
  }

  if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
    try {
      const resp = await fetch(imageUrl);
      if (!resp.ok) return null;
      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return {
        mimeType: contentType.split(';')[0],
        data: buffer.toString('base64'),
      };
    } catch {
      return null;
    }
  }

  return null;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { imageUrl, imageBase64, userNotes, locationHint } = req.body;
    const imagePart = await getImagePart(imageUrl, imageBase64);

    const promptText = `
Eres un distinguido biólogo taxónomo y curador de museo especializado en la biodiversidad de Costa Rica y el Neotrópico (UCR, INBio, OET, SINAC).
Analiza detalladamente esta fotografía de campo del espécimen biológico.
${locationHint ? `Pista de ubicación en Costa Rica: ${locationHint}` : ''}
${userNotes ? `Notas de campo adicionales: ${userNotes}` : ''}

Tu tarea es:
1. Identificar la especie con rigor científico (género y epíteto específico, p. ej. "Agalychnis callidryas").
2. Proveer los nombres vernáculos comunes en español y en inglés.
3. Clasificar la jerarquía taxonómica completa (Reino, Filo, Clase, Orden, Familia, Género, Especie, y Taxon ID estimado de ITIS/NCBI).
4. Asignar el estado de conservación según la Lista Roja de la UICN y estatus CITES con su distribución biogeográfica en Costa Rica.
5. Suministrar morfometría típica (LHC en mm o longitud total, descripción anatómica y cromática exhaustiva).
6. Describir la etología y ecología reproductiva habitual de esta especie en el bosque tropical costarricense.
7. Detallar el ritual de cortejo y reproducción (courtshipAndMating).
8. Detallar relaciones intra e interespecíficas, territorialidad, depredadores en Costa Rica y defensas/toxinas (interspecificRelations).
9. Detallar datos importantes de investigación científica confirmada en Costa Rica (confirmedScientificData, citas UCR/OET/SINAC).
10. Sugerir la zona de vida de Holdridge en Costa Rica (bmh-T, bp-PM, bs-T, etc.), microhábitat y elevación promedio.
11. Atributos bioacústicos típicos si aplica.
12. Dar puntaje de confianza (0.0 a 1.0) y explicación diagnóstica.

Responde ÚNICAMENTE con un objeto JSON válido con la estructura solicitada conteniendo:
scientificName, commonName, taxonGroup, realm, taxonomy, iucnStatus, citesStatus, morphometrics (snoutVentLengthMm, colorationAndAnatomy, ethologyAndReproduction, courtshipAndMating, interspecificRelations, confirmedScientificData, sympatricSpecies), suggestedHabitat (lifeZone, microhabitat, elevationMeters), bioacoustics, confidenceScore, identificationRationale.
`;

    const contents: Array<{
      role?: string;
      parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
    }> = [];

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: promptText },
    ];

    if (imagePart) {
      parts.push({
        inlineData: {
          mimeType: imagePart.mimeType,
          data: imagePart.data,
        },
      });
    }

    contents.push({ parts });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
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

    res.status(200).json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error en serverless handler Vercel:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Error al procesar la identificación con IA',
    });
  }
}
