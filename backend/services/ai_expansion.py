import os
import google.generativeai as genai
from pydantic import BaseModel
from typing import List
from sqlalchemy.orm import Session
from models import models

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# ==========================================
# AI SCHEMA DEFINITIONS
# ==========================================
class AITopic(BaseModel):
    name: str
    description: str
    difficulty: str # e.g., "Beginner", "Intermediate", "Advanced"

class AIDependency(BaseModel):
    parent_topic: str
    child_topic: str

class AILearningPath(BaseModel):
    topics: list[AITopic]
    dependencies: list[AIDependency]

# ==========================================
# CORE AI LOGIC (PHASE 6)
# ==========================================
def generate_ai_topics(target_topic: str) -> AILearningPath:
    """Sends a topic prompt to the Gemini API and parses it into a structured hierarchy."""
    
    prompt = f"""
    Generate a comprehensive prerequisite learning path required to master '{target_topic}'.
    Return the result as a structured list of topics and their dependencies.
    Make sure to include '{target_topic}' itself as the final topic in the list.
    """
    
    # Use gemini-1.5-flash as it is lightning fast and perfect for this task
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # Enforce strict JSON output matching our Pydantic schema
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=AILearningPath,
        )
    )
    
    # Parse the resulting JSON string directly back into our Pydantic object
    return AILearningPath.model_validate_json(response.text)


def merge_ai_path_into_db(db: Session, ai_path: AILearningPath):
    """Merges the temporary AI graph with the existing PostgreSQL topic graph."""
    
    # 1. Insert new topics into the database
    for ai_t in ai_path.topics:
        existing_topic = db.query(models.Topic).filter(models.Topic.topic_name.ilike(ai_t.name)).first()
        if not existing_topic:
            new_topic = models.Topic(
                topic_name=ai_t.name,
                description=ai_t.description,
                difficulty=ai_t.difficulty
            )
            db.add(new_topic)
    
    db.commit() # Commit all new topics so they get assigned IDs
    
    # 2. Build a mapping of topic_name -> topic_id for relationship linking
    all_topics = {t.topic_name.lower(): t.topic_id for t in db.query(models.Topic).all()}
    
    # 3. Insert new dependencies
    for ai_dep in ai_path.dependencies:
        parent_id = all_topics.get(ai_dep.parent_topic.lower())
        child_id = all_topics.get(ai_dep.child_topic.lower())
        
        if parent_id and child_id:
            # Check if this exact dependency already exists
            existing_dep = db.query(models.TopicDependency).filter(
                models.TopicDependency.parent_topic_id == parent_id,
                models.TopicDependency.child_topic_id == child_id
            ).first()
            
            if not existing_dep:
                new_dep = models.TopicDependency(
                    parent_topic_id=parent_id,
                    child_topic_id=child_id
                )
                db.add(new_dep)
                
    db.commit() # Finalize all dependencies

# ==========================================
# PHASE 9: AI PROJECT GENERATOR
# ==========================================
class AIProject(BaseModel):
    title: str
    description: str
    difficulty: str

class AIProjectList(BaseModel):
    projects: list[AIProject]

def generate_ai_projects(topic_name: str) -> AIProjectList:
    """Generates practical milestone projects for a specific topic using Gemini."""
    
    # FIX: Corrected the prompt to ask for projects, and fixed the variable name.
    prompt = f"""
    Generate a list of 3 to 5 practical, portfolio-worthy milestone projects 
    that a student could build to master the topic '{topic_name}'.
    Ensure the projects range in difficulty from Beginner to Advanced.
    Return the result as a structured list containing the title, description, and difficulty of each project.
    """
    
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=AIProjectList,
        )
    )
    
    return AIProjectList.model_validate_json(response.text)