
import { GoogleGenAI } from "@google/genai";
import { FeedbackData } from "./types";

export const analyzeFeedback = async (data: FeedbackData): Promise<string> => {
  // Inicialização estrita conforme diretrizes
  const apiKey = process.env.API_KEY || '';
  
  if (!apiKey) {
    console.warn("API_KEY não encontrada. Usando resposta padrão.");
    return `Obrigado pela sua avaliação do atendimento com ${data.professional}! Valorizamos muito o seu feedback.\n\nAtenciosamente, Hospital Santa Filomena`;
  }

  const ai = new GoogleGenAI({ apiKey });
  
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
    6. Não use markdown, apenas texto limpo.
    
    Resposta em Português.
  `;

  try {
    // Definindo um limite de tempo manual para a promessa da API
    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error("Timeout")), 8000)
    );

    const generatePromise = ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      }
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);
    
    if (!response) throw new Error("Sem resposta");

    let text = response.text || "Obrigado por sua avaliação!";
    
    if (!text.includes("Hospital Santa Filomena")) {
      text = text.trim() + "\n\nAtenciosamente, Hospital Santa Filomena";
    }
    
    return text;
  } catch (error) {
    console.error("Erro na análise do Gemini:", error);
    return `Sua avaliação sobre o atendimento com ${data.professional} foi registrada com sucesso. Agradecemos por nos ajudar a melhorar nossos serviços.\n\nAtenciosamente, Hospital Santa Filomena`;
  }
};
