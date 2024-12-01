import { Phrase } from '../types';
import { apiService } from './api.service';

export const phraseManager = {
    phrases: [] as Phrase[],
    currentIndex: 0,
  
    async init() {
      this.phrases = await apiService.fetchDailyPhrases();
      console.log('Phrases loaded:', this.phrases);
      return this.phrases;
    },
  
    async handleFeedback(wasCorrect: boolean) {
      const current = this.phrases[this.currentIndex]
      await apiService.submitPhraseResponse(current.id, wasCorrect)
      
      this.currentIndex++
      return this.phrases[this.currentIndex] // Next phrase or undefined if done
    }
  }