from pydantic import BaseModel
from typing import List, Optional

# ==========================================
# TOPIC SCHEMAS
# ==========================================
class TopicCreate(BaseModel):
    topic_name: str
    description: Optional[str] = None
    difficulty: Optional[str] = "Beginner"

class TopicResponse(TopicCreate):
    topic_id: int

    class Config:
        from_attributes = True

# ==========================================
# DEPENDENCY SCHEMAS
# ==========================================
class DependencyCreate(BaseModel):
    parent_topic_id: int
    child_topic_id: int

class DependencyResponse(DependencyCreate):
    id: int

    class Config:
        from_attributes = True

# ==========================================
# GENERATOR SCHEMAS
# ==========================================
class PathRequest(BaseModel):
    topic: str

# ==========================================
# RESOURCE SCHEMAS (PHASE 5)
# ==========================================
class ResourceBase(BaseModel):
    title: str
    url: str
    resource_type: str
    difficulty: Optional[str] = "Beginner"

class ResourceCreate(ResourceBase):
    topic_id: int

class ResourceResponse(ResourceBase):
    id: int
    topic_id: int

    class Config:
        from_attributes = True