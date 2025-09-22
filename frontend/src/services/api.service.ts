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
      const res = await fetch(`${CONFIG.BACKEND_URL}/daily_phrases`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data?.phrases) ? data.phrases : [];
    } catch (error) {
      console.error('Error fetching phrases:', error);
      return [];
    }
  },

  async fetchSystemPrompt(): Promise<string> {
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/system_prompt`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { system_prompt } = await res.json();
      return system_prompt || '';
    } catch (error) {
      console.error('Error fetching system prompt:', error);
      return '';
    }
  },

  async submitPhraseResponse(phraseId: number, wasCorrect: boolean): Promise<boolean> {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/phrases/${phraseId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correct: wasCorrect }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`);
      }
      return true;
    } catch (error) {
      console.error('Error updating phrase response:', error);
      return false;
    }
  }
};
