from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from models import schemas
from services.graph import generate_learning_path
from services.ai_expansion import generate_ai_topics, merge_ai_path_into_db
# from services.auth import get_current_user  <-- Commented out for now
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
    db: Session = Depends(get_db)
    # current_user: models.User = Depends(get_current_user) <-- TEMPORARILY REMOVED
):
    clean_topic = request.topic.strip().lower()
    
    # Use request.user_id (sent by frontend) instead of current_user.id
    user_id = request.user_id 
    
    cache_key = f"graph:{user_id}:{clean_topic}"
    
    # 1. Check Redis Cache First
    cached_graph = redis_client.get(cache_key)
    if cached_graph:
        print(f"Serving '{clean_topic}' for User {user_id} from Cache!")
        return json.loads(cached_graph)

    try:
        # Step 2: Attempt to fetch from existing database
        path = generate_learning_path(db, request.topic, user_id)
        
        # Save to Redis for 24 hours
        redis_client.setex(cache_key, 86400, json.dumps(path))
        return path
        
    except ValueError as e:
        # Step 3: Trigger Phase 6: AI Topic Expansion
        try:
            print(f"Topic '{request.topic}' not found. Generating via AI...")
            
            ai_data = generate_ai_topics(request.topic)
            merge_ai_path_into_db(db, ai_data)
            
            corrected_topic_name = ai_data.topics[-1].name
            print(f"AI generated path for corrected topic name: '{corrected_topic_name}'")
            
            new_path = generate_learning_path(db, corrected_topic_name, user_id)
            
            # Cache the newly generated AI graph!
            redis_client.setex(cache_key, 86400, json.dumps(new_path))
            return new_path
            
        except Exception as ai_e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to generate AI learning path: {str(ai_e)}")

# POST /expand-topic
@router.post("/expand-topic")
def expand_topic(
    request: schemas.PathRequest, 
    db: Session = Depends(get_db)
    # current_user: models.User = Depends(get_current_user) <-- TEMPORARILY REMOVED
):
    """Explicitly triggers AI expansion for an existing node to deepen the hybrid graph."""
    user_id = request.user_id # Use the ID from the frontend

    try:
        print(f"Force expanding '{request.topic}' via AI...")
        
        ai_data = generate_ai_topics(request.topic)
        merge_ai_path_into_db(db, ai_data)
        
        # Return the new pruned graph passing user_id
        new_path = generate_learning_path(db, request.topic, user_id)
        
        # Update the cache
        clean_topic = request.topic.strip().lower()
        cache_key = f"graph:{user_id}:{clean_topic}"
        redis_client.setex(cache_key, 86400, json.dumps(new_path))
        
        return new_path
        
    except Exception as ai_e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to expand AI learning path: {str(ai_e)}")