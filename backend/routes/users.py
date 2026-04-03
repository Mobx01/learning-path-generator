from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from models import models, schemas

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

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