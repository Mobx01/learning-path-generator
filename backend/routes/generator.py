from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from models import schemas
from services.graph import generate_learning_path
from services.ai_expansion import generate_ai_topics, merge_ai_path_into_db
from services.auth import get_current_user
from models import models
import redis
import json
import os

router = APIRouter(
    tags=["Generator"]
)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Connect using from_url
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# POST /generate-path
@router.post("/generate-path")
def generate_path(
    request: schemas.PathRequest, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # <--- THIS PROTECTS THE ROUTE
):
    clean_topic = request.topic.strip().lower()
    
    # We include current_user.id in the cache key so users don't see each other's "Completed" green nodes!
    cache_key = f"graph:{current_user.id}:{clean_topic}"
    
    # 1. Check Redis Cache First
    cached_graph = redis_client.get(cache_key)
    if cached_graph:
        print(f"Serving '{clean_topic}' for User {current_user.id} from Cache!")
        return json.loads(cached_graph)

    try:
        # Step 2: Attempt to fetch from existing database
        path = generate_learning_path(db, request.topic, current_user.id)
        
        # Save to Redis for 24 hours (86400 seconds) so next time it's instant!
        redis_client.setex(cache_key, 86400, json.dumps(path))
        return path
        
    except ValueError as e:
        # Step 3: If topic is missing, trigger Phase 6: AI Topic Expansion
        try:
            print(f"Topic '{request.topic}' not found. Generating via AI...")
            
            ai_data = generate_ai_topics(request.topic)
            merge_ai_path_into_db(db, ai_data)
            
            # Find the actual, spell-checked name the AI generated
            corrected_topic_name = ai_data.topics[-1].name
            print(f"AI generated path for corrected topic name: '{corrected_topic_name}'")
            
            # Run the graph algorithm using the CORRECTED name
            new_path = generate_learning_path(db, corrected_topic_name, current_user.id)
            
            # Cache the newly generated AI graph!
            redis_client.setex(cache_key, 86400, json.dumps(new_path))
            return new_path
            
        except Exception as ai_e:
            import traceback
            traceback.print_exc() # This ensures the real error prints if it fails again
            raise HTTPException(status_code=500, detail=f"Failed to generate AI learning path: {str(ai_e)}")

# POST /expand-topic (Phase 7)
@router.post("/expand-topic")
def expand_topic(
    request: schemas.PathRequest, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # Secure this route too!
):
    """Explicitly triggers AI expansion for an existing node to deepen the hybrid graph."""
    try:
        print(f"Force expanding '{request.topic}' via AI...")
        
        ai_data = generate_ai_topics(request.topic)
        merge_ai_path_into_db(db, ai_data)
        
        # Return the new pruned graph passing user_id
        new_path = generate_learning_path(db, request.topic, current_user.id)
        
        # Update the cache with the new deeper graph!
        clean_topic = request.topic.strip().lower()
        cache_key = f"graph:{current_user.id}:{clean_topic}"
        redis_client.setex(cache_key, 86400, json.dumps(new_path))
        
        return new_path
        
    except Exception as ai_e:
        import traceback
        traceback.print_exc() # <-- THIS WILL PRINT THE EXACT ERROR!
        raise HTTPException(status_code=500, detail=f"Failed to generate AI learning path: {str(ai_e)}")