
import { GoogleGenAI, Type } from "@google/genai";
import { RegistroProducao } from "../types";

export const extractDataFromImage = async (base64Image: string): Promise<RegistroProducao> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `Você é um especialista em transcrição de formulários industriais manuscritos de alta precisão.
  REGRAS CRÍTICAS DE TRANSCRIÇÃO:
  1. TURNO: Identifique qual turno (1, 2 ou 3) está assinalado ou escrito no topo do formulário.
  2. FIDELIDADE AOS PIXELS: Transcreva exatamente os horários (HH:MM) que vê na imagem. Não arredonde ou invente horários para fechar contas. Se estiver ilegível, deixe nulo.
  3. MAPEAMENTO DE EQUIPAMENTO: Extraia o texto da coluna da direita (onde consta rotuladora, empacotadora, sopra, etc.) para o campo 'equipamento'.
  4. CÁLCULO DE TEMPO: O campo 'total_min' deve ser a diferença em minutos entre o término e o início.
  5. DATA: Formate como YYYY-MM-DD.
  Retorne rigorosamente no formato JSON solicitado.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image
          }
        },
        { text: "Extraia todos os dados do formulário industrial, identificando o turno e garantindo precisão absoluta nos horários." }
      ]
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          data_registro: { type: Type.STRING },
          linha_producao: { type: Type.STRING },
          turno: { type: Type.STRING, description: "O número do turno identificado (1, 2 ou 3)" },
          produto_volume: { type: Type.STRING },
          lote: { type: Type.STRING },
          paradas: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                cod: { type: Type.STRING },
                inicio: { type: Type.STRING },
                termino: { type: Type.STRING },
                total_min: { type: Type.NUMBER },
                equipamento: { type: Type.STRING }
              },
              required: ['cod', 'inicio', 'termino', 'total_min', 'equipamento']
            }
          },
          observacoes: { type: Type.STRING }
        },
        required: ['data_registro', 'linha_producao', 'turno', 'produto_volume', 'lote', 'paradas', 'observacoes']
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Falha na comunicação com o motor de IA.");
  
  try {
    return JSON.parse(text) as RegistroProducao;
  } catch (e) {
    throw new Error("Erro ao processar estrutura de dados. Capture novamente.");
  }
};
