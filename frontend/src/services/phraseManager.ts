import { Phrase } from '../types';
import { apiService } from './api.service';

export const phraseManager = {
    phrases: [] as Phrase[],
    currentIndex: 0,
  
    async init() {
      this.phrases = await apiService.fetchDailyPhrases();
      return this.phrases;
    },
  
    async handleFeedback(wasCorrect: boolean) {
      const current = this.phrases[this.currentIndex];
      if (!current) return undefined;
      const ok = await apiService.submitPhraseResponse(current.id, wasCorrect);
      if (!ok) return current;
      this.currentIndex++;
      return this.phrases[this.currentIndex] || undefined;
    }
  }
