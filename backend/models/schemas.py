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
    user_id: Optional[int] = None

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

# ... keep your existing schemas at the top ...

# ==========================================
# USER SCHEMAS (PHASE 8)
# ==========================================
class UserBase(BaseModel):
    username: str
    experience_level: Optional[str] = "Beginner"
    learning_goal: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True

class MarkTopicKnownRequest(BaseModel):
    topic_id: int