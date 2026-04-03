from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from models import schemas
from services.graph import generate_learning_path

# Import Phase 6/7 logic
from services.ai_expansion import generate_ai_topics, merge_ai_path_into_db

router = APIRouter(
    tags=["Generator"]
)

# POST /generate-path
@router.post("/generate-path")
def generate_path(request: schemas.PathRequest, db: Session = Depends(get_db)):
    try:
        # Step 1: Attempt to fetch from existing database
        path = generate_learning_path(db, request.topic, request.user_id)
        return path
        
    except ValueError as e:
        # Step 2: If topic is missing, trigger Phase 6: AI Topic Expansion
        try:
            print(f"Topic '{request.topic}' not found. Generating via AI...")
            
            ai_data = generate_ai_topics(request.topic)
            merge_ai_path_into_db(db, ai_data)
            
            # THE FIX: Find the actual, spell-checked name the AI generated
            # We enforce in the prompt that the target topic is the LAST topic in the list
            corrected_topic_name = ai_data.topics[-1].name
            print(f"AI generated path for corrected topic name: '{corrected_topic_name}'")
            
            # Step 3: Run the graph algorithm using the CORRECTED name
            new_path = generate_learning_path(db, corrected_topic_name, request.user_id)
            return new_path
            
        except Exception as ai_e:
            import traceback
            traceback.print_exc() # This ensures the real error prints if it fails again
            raise HTTPException(status_code=500, detail=f"Failed to generate AI learning path: {str(ai_e)}")

# POST /expand-topic (Phase 7)
@router.post("/expand-topic")
def expand_topic(request: schemas.PathRequest, db: Session = Depends(get_db)):
    """Explicitly triggers AI expansion for an existing node to deepen the hybrid graph."""
    try:
        print(f"Force expanding '{request.topic}' via AI...")
        
        ai_data = generate_ai_topics(request.topic)
        merge_ai_path_into_db(db, ai_data)
        
        # Return the new pruned graph passing user_id
        new_path = generate_learning_path(db, request.topic, request.user_id)
        return new_path
        
    except Exception as ai_e:
                import traceback
                traceback.print_exc() # <-- THIS WILL PRINT THE EXACT ERROR!
                raise HTTPException(status_code=500, detail=f"Failed to generate AI learning path: {str(ai_e)}")