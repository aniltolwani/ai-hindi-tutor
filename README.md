# ai-hindi-tutor
world's best hindi-tutor using realtime voice API, spaced repetition, and a focus on best language learning principles 1) speaking 2) spaced repetition and 3) learning in context


# AI Language Tutor - Technical Design Specification

## System Overview
A language learning system that combines real-time speech interaction, spaced repetition, and contextual learning to create an immersive learning experience.

## Core Components

### 1. Data Models

#### User Profile
```
user_id: UUID
target_language: string
native_language: string
current_level: enum (A1-C2)
daily_goal: int (minutes)
active_days: int
last_active: timestamp
learning_preferences: JSON
```

#### Learning Progress
```
user_id: UUID
phrase_id: UUID
mastery_level: float (0-1)
last_reviewed: timestamp
next_review: timestamp
review_history: JSON
error_patterns: JSON
```

#### Phrase Bank
```
phrase_id: UUID
text: string
translation: string
difficulty_level: float (0-1)
contexts: string[]
prerequisites: phrase_id[]
usage_examples: string[]
```

#### Learning Session
```
session_id: UUID
user_id: UUID
timestamp: timestamp
duration: int
phrases_covered: phrase_id[]
performance_metrics: JSON
feedback_given: JSON
```

### 2. File Structure

```
/data
  /phrases
    - core_phrases.json       (500 most common phrases)
    - context_templates.json  (scenario-based templates)
    - difficulty_mapping.json (phrase complexity ratings)
  
  /user
    - profiles/              (user progress & preferences)
    - sessions/              (historical session data)
    - analytics/             (learning metrics & patterns)

  /audio
    - templates/             (scenario background audio)
    - pronunciations/        (correct pronunciation samples)
```

### 3. Core Services

#### Speech Service
- Input: Raw audio stream
- Output: Transcribed text, pronunciation score, fluency metrics
- Integration: Cloud speech-to-text API
- Metrics tracked: accuracy, speed, hesitation, intonation

#### Learning Engine
- Manages spaced repetition scheduling
- Selects appropriate phrases based on user level
- Tracks mastery and progression
- Implements i+1 principle for content selection

#### Conversation Generator
- Creates natural dialogue flows
- Maintains context continuity
- Generates appropriate responses
- Scales difficulty based on user performance

#### Progress Tracker
- Monitors learning metrics
- Generates performance insights
- Adapts difficulty curves
- Provides achievement milestones

### 4. Integration Points

#### External APIs
- Speech recognition service
- Text-to-speech engine
- LLM for conversation generation
- Analytics platform

#### Data Storage
- User profiles: NoSQL document store
- Session history: Time-series database
- Analytics: Data warehouse
- Audio files: Object storage

### 5. Learning Flow

#### Daily Session Structure
1. Review Module
   - Due phrases from spaced repetition
   - Error pattern review
   - Quick pronunciation check

2. New Content Module
   - 20-30 new phrases daily
   - Contextual introduction
   - Immediate practice

3. Conversation Practice
   - Scenario-based dialogs
   - Real-time feedback
   - Progressive difficulty

### 6. Analytics

#### User Metrics
- Speaking confidence
- Response time
- Error patterns
- Vocabulary retention
- Daily streak
- Time spent learning

#### System Metrics
- Phrase effectiveness
- Error patterns
- User progression rates
- Engagement metrics
- Feature usage

### 7. Feedback Mechanisms

#### Real-time Feedback
- Pronunciation correction
- Grammar guidance
- Vocabulary suggestions
- Fluency metrics

#### Session Feedback
- Performance summary
- Areas for improvement
- Next session preview
- Achievement updates

## Implementation Priorities

### Phase 1: MVP
1. Core phrase bank
2. Basic speech recognition
3. Simple spaced repetition
4. Text-based conversations

### Phase 2: Enhancement
1. Advanced speech analysis
2. Dynamic difficulty adjustment
3. Expanded context scenarios
4. Progress analytics

### Phase 3: Optimization
1. Personalized learning paths
2. Advanced error detection
3. Native speaker variations
4. Community features


/ai-language-tutor
├── app.py                     # Main application file
├── requirements.txt           # Just core dependencies
├── .env                      # API keys & config
│
├── /data                    
│   ├── phrases.json          # Core 500 phrases with translations
│   ├── practice.json         # Learning contexts/scenarios
│   └── users/               # User progress files
│
└── /models                   # Core data structures
    ├── session.py            # Learning session logic
    ├── user.py              # User state & progress
    └── phrases.py           # Phrase management

Using:
- Supabase for DB
- extremely simple UI (just push to talk for now)
- OpenAI realtime API for voice to voice and pronounciation feedback (just ask the LLM to do the critiquing and generate phrases etc.)
- Simple spaced repetition formula i.e [1,2, 4, 7, 13, 21, 34, 55, 89]