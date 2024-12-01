import { CONFIG } from '../config/constants';
import { Phrase } from '../types';

export const apiService = {
  getApiKey() {
    if (CONFIG.RELAY_SERVER_URL) return '';
    const storedKey = localStorage.getItem(CONFIG.API_KEY_STORAGE_KEY);
    const promptedKey = storedKey || prompt('OpenAI API Key') || '';
    if (promptedKey) localStorage.setItem(CONFIG.API_KEY_STORAGE_KEY, promptedKey);
    return promptedKey;
  },

  async fetchDailyPhrases(): Promise<Phrase[]> {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/daily_phrases`);
      const data = await response.json();
      return data.phrases;
    } catch (error) {
      console.error('Error fetching phrases:', error);
      return [];
    }
  },

  async fetchSystemPrompt(): Promise<string> {
    const response = await fetch(`${CONFIG.BACKEND_URL}/system_prompt`);
    const { system_prompt } = await response.json();
    return system_prompt;
  },

  async submitPhraseResponse(phraseId: number, wasCorrect: boolean): Promise<boolean> {
    try {
      console.log(`Sending review for phrase ${phraseId} with correct=${wasCorrect}`);
      const response = await fetch(`${CONFIG.BACKEND_URL}/phrases/${phraseId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correct: wasCorrect }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`);
      }
      return true;
    } catch (error) {
      console.error('Error updating phrase response:', error);
      return false;
    }
  }
};
