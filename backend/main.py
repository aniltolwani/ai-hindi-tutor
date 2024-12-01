from fastapi import FastAPI, HTTPException, Depends, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
import json
from typing import List, Optional
import os
from dotenv import load_dotenv
import websockets
import asyncio
import random
from db import supabase

load_dotenv()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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

class PhraseReview(BaseModel):
    correct: bool

@app.get("/phrases/due", response_model=List[Phrase])
async def get_due_phrases(limit: int = 10):
    # Get overdue phrases first
    now = datetime.utcnow()
    overdue = supabase.table("phrases") \
        .select("*") \
        .lte("next_review", now.isoformat()) \
        .order("next_review") \
        .limit(limit) \
        .execute()
    
    phrases = [Phrase(**p) for p in overdue.data]
    
    # If we need more phrases, get new ones based on difficulty
    if len(phrases) < limit:
        remaining = limit - len(phrases)
        new_phrases = supabase.table("phrases") \
            .select("*") \
            .filter("next_review", "is", "null") \
            .order("difficulty") \
            .limit(remaining) \
            .execute()
        
        phrases.extend([Phrase(**p) for p in new_phrases.data])
    
    return phrases

@app.post("/phrases/{phrase_id}/review")
async def review_phrase(phrase_id: int, review: PhraseReview):
    # Get current phrase data
    result = supabase.table("phrases") \
        .select("*") \
        .eq("id", phrase_id) \
        .execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Phrase not found")
    
    phrase = result.data[0]
    now = datetime.utcnow()
    
    # Update spaced repetition data
    if review.correct:
        next_interval = INTERVALS[min(phrase["repetition_index"] + 1, len(INTERVALS) - 1)]
        mastery_increase = 0.1 * (1.0 - phrase["mastery_level"])  # Diminishing returns
        new_mastery = min(1.0, phrase["mastery_level"] + mastery_increase)
        rep_index = min(phrase["repetition_index"] + 1, len(INTERVALS) - 1)
    else:
        next_interval = INTERVALS[0]  # Reset to first interval
        mastery_decrease = 0.2 * phrase["mastery_level"]  # Larger penalty for mistakes
        new_mastery = max(0.0, phrase["mastery_level"] - mastery_decrease)
        rep_index = 0
    
    next_review = now + timedelta(days=next_interval)
    
    # Update phrase in database
    supabase.table("phrases") \
        .update({
            "last_reviewed": now.isoformat(),
            "next_review": next_review.isoformat(),
            "repetition_index": rep_index,
            "mastery_level": new_mastery
        }) \
        .eq("id", phrase_id) \
        .execute()
    
    return {"status": "success"}


@app.get("/daily_phrases")
async def get_daily_phrases(limit: int = 10):
    now = datetime.utcnow().isoformat()
    
    # 1. First get all overdue cards (where next_review is in the past)
    overdue = supabase.table("phrases") \
        .select("*") \
        .lte("next_review", now) \
        .filter("next_review", "not.is", "null") \
        .order("next_review") \
        .execute()
    
    phrases = [Phrase(**p) for p in overdue.data]
    
    # 2. If we need more cards, get new ones that haven't been reviewed yet
    if len(phrases) < limit:
        remaining = limit - len(phrases)
        new_cards = supabase.table("phrases") \
            .select("*") \
            .filter("next_review", "is", "null") \
            .order("difficulty") \
            .limit(remaining) \
            .execute()
        
        phrases.extend([Phrase(**p) for p in new_cards.data])
    
    return {"phrases": phrases[:limit]}

@app.post("/phrase_response")
async def handle_phrase_response(phrase_id: int, was_correct: bool):
    phrase = supabase.table("phrases").select("*").eq("id", phrase_id).execute().data[0]
    
    # Update phrase mastery and schedule
    if was_correct:
        phrase["mastery_level"] = min(1.0, phrase["mastery_level"] + 0.1)
        phrase["repetition_index"] = min(len(INTERVALS) - 1, phrase["repetition_index"] + 1)
    else:
        phrase["mastery_level"] = max(0.0, phrase["mastery_level"] - 0.1)
        phrase["repetition_index"] = max(0, phrase["repetition_index"] - 1)
    
    # Set next review date
    phrase["last_reviewed"] = datetime.utcnow().isoformat()
    days_until_next = INTERVALS[phrase["repetition_index"]]
    phrase["next_review"] = (datetime.utcnow() + timedelta(days=days_until_next)).isoformat()
    
    # Update phrase in database
    supabase.table("phrases") \
        .update({
            "last_reviewed": phrase["last_reviewed"],
            "next_review": phrase["next_review"],
            "repetition_index": phrase["repetition_index"],
            "mastery_level": phrase["mastery_level"]
        }) \
        .eq("id", phrase_id) \
        .execute()
    
    return {"status": "success", "next_review": phrase["next_review"]}

@app.get("/system_prompt")
async def get_system_prompt():
    try:
        with open("data/system_prompt.txt", "r") as f:
            system_prompt = f.read()
        return {"system_prompt": system_prompt}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="System prompt file not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
