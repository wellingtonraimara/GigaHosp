
import { GoogleGenAI } from "@google/genai";
import { FeedbackData } from "./types";

export const analyzeFeedback = async (data: FeedbackData) => {
  // Inicialização direta conforme recomendações da SDK
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `
    Analise o seguinte feedback de atendimento médico e gere uma resposta de agradecimento oficial.
    
    Dados:
    - Profissional: ${data.professional}
    - Nota de Atendimento: ${data.nps}/10
    - Comentário: "${data.comment || 'Nenhum comentário fornecido'}"

    Instruções para a resposta:
    1. Seja breve, caloroso e profissional.
    2. Mencione o nome do profissional (${data.professional}) de forma positiva se a nota for alta.
    3. Se a nota for baixa (0-6), mostre empatia e mencione que estamos trabalhando para melhorar o serviço.
    4. Se a nota for alta (7-10), mostre gratidão genuína.
    5. OBRIGATÓRIO: Toda resposta DEVE terminar exatamente com a assinatura: "Atenciosamente, Hospital Santa Filomena".
    6. Não use formatação markdown excessiva na resposta, apenas texto limpo.
    
    A resposta deve ser em Português.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      }
    });
    
    // Usando a propriedade .text conforme diretrizes
    let text = response.text || "Obrigado por sua avaliação!";
    
    if (!text.includes("Hospital Santa Filomena")) {
      text = text.trim() + "\n\nAtenciosamente, Hospital Santa Filomena";
    }
    
    return text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return `Obrigado pela sua avaliação do atendimento com ${data.professional}! Valorizamos muito o seu feedback.\n\nAtenciosamente, Hospital Santa Filomena`;
  }
};
