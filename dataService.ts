
import { FeedbackData } from "./types";

const STORAGE_KEY = 'hospital_santa_filomena_stats';

/**
 * SERVIÇO DE SINCRONIZAÇÃO GLOBAL
 * Para que os dados apareçam em qualquer dispositivo, este serviço 
 * deve ser conectado a um banco de dados real (Firebase, Supabase, MongoDB, etc).
 */
export const dataService = {
  /**
   * Recupera os feedbacks. 
   * Substitua o bloco try pelo fetch da sua API para sincronização global.
   */
  async getAllFeedbacks(): Promise<FeedbackData[]> {
    try {
      // Atualmente buscando do armazenamento do navegador (Local)
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];

      /* 
      // EXEMPLO PARA SINCRONIZAÇÃO REAL (Substitua a URL):
      const response = await fetch('https://SUA-API-NO-HEROKU-OU-VERCEL.com/feedbacks');
      return await response.json();
      */
    } catch (error) {
      console.error("Erro na sincronização:", error);
      return [];
    }
  },

  /**
   * Salva o feedback na nuvem/local.
   */
  async saveFeedback(feedback: FeedbackData): Promise<boolean> {
    try {
      const history = await this.getAllFeedbacks();
      const newHistory = [...history, feedback];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      
      /* 
      // EXEMPLO PARA SALVAR NA NUVEM:
      await fetch('https://SUA-API-NO-HEROKU-OU-VERCEL.com/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback)
      });
      */
      
      return true;
    } catch (error) {
      console.error("Erro ao salvar:", error);
      return false;
    }
  },

  /**
   * Limpa o banco de dados.
   */
  async clearAllData(): Promise<boolean> {
    try {
      localStorage.removeItem(STORAGE_KEY);
      
      /* 
      // EXEMPLO PARA RESET NA NUVEM:
      await fetch('https://SUA-API-NO-HEROKU-OU-VERCEL.com/feedbacks', { method: 'DELETE' });
      */
      
      return true;
    } catch (error) {
      return false;
    }
  }
};
