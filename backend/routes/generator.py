from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from models import schemas
from services.graph import generate_learning_path

# Import the new Phase 6 logic
from services.ai_expansion import generate_ai_topics, merge_ai_path_into_db

router = APIRouter(
    tags=["Generator"]
)

# POST /generate-path
@router.post("/generate-path")
def generate_path(request: schemas.PathRequest, db: Session = Depends(get_db)):
    try:
        # Step 1: Attempt to fetch from existing database
        path = generate_learning_path(db, request.topic)
        return path
        
    except ValueError as e:
        # Step 2: If topic is missing, trigger Phase 6: AI Topic Expansion
        try:
            print(f"Topic '{request.topic}' not found. Generating via AI...")
            
            # Fetch structured hierarchy from OpenAI
            ai_data = generate_ai_topics(request.topic)
            
            # Merge with existing PostgreSQL graph
            merge_ai_path_into_db(db, ai_data)
            
            # Step 3: Run the graph algorithm again now that the DB is populated
            new_path = generate_learning_path(db, request.topic)
            return new_path
            
        except Exception as ai_e:
            # Fallback if OpenAI fails or parsing fails
            raise HTTPException(status_code=500, detail=f"Failed to generate AI learning path: {str(ai_e)}")
        
# POST /expand-topic
@router.post("/expand-topic")
def expand_topic(request: schemas.PathRequest, db: Session = Depends(get_db)):
    """Explicitly triggers AI expansion for an existing node to deepen the hybrid graph."""
    try:
        print(f"Force expanding '{request.topic}' via AI...")
        
        # 1. Fetch structured hierarchy from Gemini
        ai_data = generate_ai_topics(request.topic)
        
        # 2. Merge with existing PostgreSQL graph (removes duplicates natively)
        merge_ai_path_into_db(db, ai_data)
        
        # 3. Run Kahn's algorithm to get the newly updated, hybrid graph
        new_path = generate_learning_path(db, request.topic)
        return new_path
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to expand topic: {str(e)}")