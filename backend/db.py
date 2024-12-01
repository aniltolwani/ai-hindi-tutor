from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Schema for reference:
"""
create table phrases (
    id serial primary key,
    hindi text not null,
    english text not null,
    context text,
    difficulty float default 0.5,
    last_reviewed timestamp,
    next_review timestamp,
    repetition_index integer default 0,
    mastery_level float default 0.0,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

create index idx_next_review on phrases(next_review);
create index idx_difficulty on phrases(difficulty);
"""
