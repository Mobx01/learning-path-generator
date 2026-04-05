from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from models import models, schemas
from services.auth import create_access_token

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

# --- NEW HELPER: Prevents Foreign Key Crashes ---
def ensure_user_exists(db: Session, user_id: int):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        # Create a dummy user to satisfy the database relationship
        new_user = models.User(username=f"guest_user_{user_id}")
        # Note: If your models.User auto-increments IDs, we force it to match the frontend
        new_user.id = user_id 
        db.add(new_user)
        db.commit()

# Create a new user
@router.post("/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.username == user.username).first()
    if existing_user:
        return existing_user # Return existing if they log in again
    
    new_user = models.User(**user.model_dump())
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# Mark a topic as known
@router.post("/{user_id}/known-topics")
def mark_topic_known(user_id: int, req: schemas.MarkTopicKnownRequest, db: Session = Depends(get_db)):
    ensure_user_exists(db, user_id) # <-- THE FIX

    # Check if already known
    existing = db.query(models.UserKnownTopic).filter(
        models.UserKnownTopic.user_id == user_id,
        models.UserKnownTopic.topic_id == req.topic_id
    ).first()
    
    if not existing:
        known_link = models.UserKnownTopic(user_id=user_id, topic_id=req.topic_id)
        db.add(known_link)
        db.commit()
    
    return {"message": "Topic marked as known"}
    
# Get all known topics for a user
@router.get("/{user_id}/known-topics")
def get_known_topics(user_id: int, db: Session = Depends(get_db)):
    known = db.query(models.UserKnownTopic).filter(models.UserKnownTopic.user_id == user_id).all()
    return [k.topic_id for k in known]

# ==========================================
# PHASE 10: PROGRESS ENDPOINTS
# ==========================================

# Mark a topic as completed
@router.post("/{user_id}/completed-topics")
def mark_topic_completed(user_id: int, req: schemas.MarkTopicKnownRequest, db: Session = Depends(get_db)):
    ensure_user_exists(db, user_id) # <-- THE FIX

    existing = db.query(models.UserCompletedTopic).filter(
        models.UserCompletedTopic.user_id == user_id,
        models.UserCompletedTopic.topic_id == req.topic_id
    ).first()
    
    if not existing:
        completed_link = models.UserCompletedTopic(user_id=user_id, topic_id=req.topic_id)
        db.add(completed_link)
        db.commit()
    return {"message": "Topic marked as completed"}

# Remove a topic from completed (Undo)
@router.delete("/{user_id}/completed-topics/{topic_id}")
def unmark_topic_completed(user_id: int, topic_id: int, db: Session = Depends(get_db)):
    existing = db.query(models.UserCompletedTopic).filter(
        models.UserCompletedTopic.user_id == user_id,
        models.UserCompletedTopic.topic_id == topic_id
    ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
    return {"message": "Topic removed from completed"}

# Get all completed topics for a user
@router.get("/{user_id}/completed-topics")
def get_completed_topics(user_id: int, db: Session = Depends(get_db)):
    completed = db.query(models.UserCompletedTopic).filter(models.UserCompletedTopic.user_id == user_id).all()
    return [c.topic_id for c in completed]

# Add this route to handle login and token generation
@router.post("/login")
def login(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Find user or create a new one if they don't exist
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if not db_user:
        db_user = models.User(username=user.username)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    
    # Generate the JWT token with their user ID
    access_token = create_access_token(data={"sub": str(db_user.id)})
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": db_user.id,
        "username": db_user.username
    }