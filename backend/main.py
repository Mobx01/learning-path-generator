from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database.database import get_db, engine, Base
from models import models
from routes import topics, generator

# Create the database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Hybrid AI Learning Path Generator",
    description="API for generating structured learning roadmaps",
    version="1.0.0"
)

# CORS configuration to allow React to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(topics.router)
app.include_router(generator.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Learning Path Generator API!"}

@app.get("/db-test")
def test_db_connection(db: Session = Depends(get_db)):
    try:
        db.execute("SELECT 1")
        return {"status": "success", "message": "Database connection is fully operational!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}