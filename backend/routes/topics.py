from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from models import models, schemas

router = APIRouter(
    prefix="/topics",
    tags=["Topics"]
)

# POST route to add a new seed topic
@router.post("/", response_model=schemas.TopicResponse)
def create_topic(topic: schemas.TopicCreate, db: Session = Depends(get_db)):
    # Check if topic already exists
    existing_topic = db.query(models.Topic).filter(models.Topic.topic_name == topic.topic_name).first()
    if existing_topic:
        raise HTTPException(status_code=400, detail="Topic already exists")
    
    # Create and save the new topic
    new_topic = models.Topic(
        topic_name=topic.topic_name,
        description=topic.description,
        difficulty=topic.difficulty
    )
    db.add(new_topic)
    db.commit()
    db.refresh(new_topic)
    return new_topic

# GET route to fetch all topics
@router.get("/", response_model=list[schemas.TopicResponse])
def get_topics(db: Session = Depends(get_db)):
    return db.query(models.Topic).all()
# POST route to link a prerequisite (parent) to a topic (child)
@router.post("/dependencies/", response_model=schemas.DependencyResponse)
def create_dependency(dependency: schemas.DependencyCreate, db: Session = Depends(get_db)):
    # Verify both topics exist
    parent = db.query(models.Topic).filter(models.Topic.topic_id == dependency.parent_topic_id).first()
    child = db.query(models.Topic).filter(models.Topic.topic_id == dependency.child_topic_id).first()
    
    if not parent or not child:
        raise HTTPException(status_code=404, detail="One or both topics not found")

    # Check if relationship already exists
    existing_dep = db.query(models.TopicDependency).filter(
        models.TopicDependency.parent_topic_id == dependency.parent_topic_id,
        models.TopicDependency.child_topic_id == dependency.child_topic_id
    ).first()
    
    if existing_dep:
        raise HTTPException(status_code=400, detail="Dependency already exists")

    # Create the link
    new_dep = models.TopicDependency(
        parent_topic_id=dependency.parent_topic_id,
        child_topic_id=dependency.child_topic_id
    )
    db.add(new_dep)
    db.commit()
    db.refresh(new_dep)
    return new_dep

# GET route to fetch all dependencies
@router.get("/dependencies/", response_model=list[schemas.DependencyResponse])
def get_dependencies(db: Session = Depends(get_db)):
    return db.query(models.TopicDependency).all()