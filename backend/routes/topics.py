from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from models import models, schemas

router = APIRouter(
    prefix="/topics",
    tags=["Topics"]
)

# ==========================================
# TOPIC ROUTES
# ==========================================

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

# ==========================================
# DEPENDENCY ROUTES
# ==========================================

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

# ==========================================
# RESOURCE ROUTES (PHASE 5)
# ==========================================

# POST route to add a new learning resource to a specific topic
@router.post("/{topic_id}/resources", response_model=schemas.ResourceResponse)
def add_resource_to_topic(topic_id: int, resource: schemas.ResourceBase, db: Session = Depends(get_db)):
    # Verify the topic exists
    db_topic = db.query(models.Topic).filter(models.Topic.topic_id == topic_id).first()
    if not db_topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Create the resource and link it to the topic_id
    new_resource = models.Resource(
        topic_id=topic_id,
        title=resource.title,
        url=resource.url,
        resource_type=resource.resource_type,
        difficulty=resource.difficulty
    )
    db.add(new_resource)
    db.commit()
    db.refresh(new_resource)
    return new_resource

# GET route to fetch all resources for a specific topic
@router.get("/{topic_id}/resources", response_model=list[schemas.ResourceResponse])
def get_topic_resources(topic_id: int, db: Session = Depends(get_db)):
    # Verify the topic exists
    db_topic = db.query(models.Topic).filter(models.Topic.topic_id == topic_id).first()
    if not db_topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Fetch and return all resources matching the topic_id
    resources = db.query(models.Resource).filter(models.Resource.topic_id == topic_id).all()
    return resources