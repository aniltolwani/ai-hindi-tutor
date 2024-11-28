from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
import json
from typing import List, Optional
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Spaced repetition intervals (in days)
INTERVALS = [1, 2, 4, 7, 13, 21, 34, 55, 89]

class Phrase(BaseModel):
    id: int
    hindi: str
    english: str
    context: str
    difficulty: float
    last_reviewed: Optional[datetime] = None
    next_review: Optional[datetime] = None
    repetition_index: int = 0
    mastery_level: float = 0.0

# In-memory storage for MVP (replace with database later)
phrases = []

# Load initial phrases
try:
    with open("data/phrases.json", "r", encoding="utf-8") as f:
        phrases_data = json.load(f)
        phrases = [Phrase(**phrase) for phrase in phrases_data]
except FileNotFoundError:
    # Initialize with some basic phrases if file doesn't exist
    phrases = [
        Phrase(
            id=1,
            hindi="नमस्ते",
            english="Hello",
            context="Greeting",
            difficulty=0.1,
        ),
        Phrase(
            id=2,
            hindi="धन्यवाद",
            english="Thank you",
            context="Gratitude",
            difficulty=0.1,
        ),
    ]

@app.get("/phrases/due")
async def get_due_phrases() -> List[Phrase]:
    """Get phrases that are due for review based on spaced repetition."""
    now = datetime.now()
    due_phrases = [
        phrase for phrase in phrases
        if not phrase.next_review or phrase.next_review <= now
    ]
    return due_phrases

@app.post("/phrases/{phrase_id}/review")
async def review_phrase(phrase_id: int, correct: bool):
    """Update phrase after review, adjusting the spaced repetition schedule."""
    phrase = next((p for p in phrases if p.id == phrase_id), None)
    if not phrase:
        raise HTTPException(status_code=404, detail="Phrase not found")

    now = datetime.now()
    
    # Update mastery level
    if correct:
        # Move to next interval if correct
        if phrase.repetition_index < len(INTERVALS) - 1:
            phrase.repetition_index += 1
        phrase.mastery_level = min(1.0, phrase.mastery_level + 0.1)
    else:
        # Reset interval if incorrect
        phrase.repetition_index = max(0, phrase.repetition_index - 1)
        phrase.mastery_level = max(0.0, phrase.mastery_level - 0.1)

    # Schedule next review
    days = INTERVALS[phrase.repetition_index]
    phrase.last_reviewed = now
    phrase.next_review = now + timedelta(days=days)

    return phrase

@app.get("/phrases/stats")
async def get_stats():
    """Get learning statistics."""
    total_phrases = len(phrases)
    mastered_phrases = sum(1 for p in phrases if p.mastery_level >= 0.8)
    average_mastery = sum(p.mastery_level for p in phrases) / total_phrases if total_phrases > 0 else 0

    return {
        "total_phrases": total_phrases,
        "mastered_phrases": mastered_phrases,
        "average_mastery": average_mastery,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)