from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database.database import Base

# Model for the 'topics' table
class Topic(Base):
    __tablename__ = "topics"

    topic_id = Column(Integer, primary_key=True, index=True) 
    topic_name = Column(String, unique=True, index=True, nullable=False) 
    description = Column(String) 
    difficulty = Column(String) # e.g., Beginner, Intermediate, Advanced

    # Establish a relationship to the resources (One Topic -> Many Resources)
    resources = relationship("Resource", back_populates="topic", cascade="all, delete-orphan")

# Model for the 'topic_dependencies' table
class TopicDependency(Base):
    __tablename__ = "topic_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    parent_topic_id = Column(Integer, ForeignKey("topics.topic_id"), nullable=False) 
    child_topic_id = Column(Integer, ForeignKey("topics.topic_id"), nullable=False) 

# Model for the 'resources' table (PHASE 5)
class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.topic_id", ondelete="CASCADE")) 
    
    title = Column(String, index=True)
    url = Column(String)
    resource_type = Column(String) # e.g., "Video", "Article", "Course"
    difficulty = Column(String, default="beginner") 

    # Virtual link back to the parent Topic
    topic = relationship("Topic", back_populates="resources")

