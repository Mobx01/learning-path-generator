from sqlalchemy import Column, Integer, String, ForeignKey
from database.database import Base

# Model for the 'topics' table [cite: 62]
class Topic(Base):
    __tablename__ = "topics"

    topic_id = Column(Integer, primary_key=True, index=True) # [cite: 63]
    topic_name = Column(String, unique=True, index=True, nullable=False) # [cite: 64]
    description = Column(String) # [cite: 65]
    difficulty = Column(String) # e.g., Beginner, Intermediate, Advanced [cite: 66]

# Model for the 'topic_dependencies' table [cite: 67]
class TopicDependency(Base):
    __tablename__ = "topic_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    parent_topic_id = Column(Integer, ForeignKey("topics.topic_id"), nullable=False) # [cite: 68]
    child_topic_id = Column(Integer, ForeignKey("topics.topic_id"), nullable=False) # [cite: 68]