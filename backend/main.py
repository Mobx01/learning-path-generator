import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

from database.database import get_db, engine, Base
from models import models

# Import your routers
from routes import topics, generator, users

# Create the database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Hybrid AI Learning Path Generator",
    description="API for generating structured learning roadmaps",
    version="1.0.0"
)

# Get the frontend URL from environment variables, fallback to localhost for dev
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# CORS configuration to allow the frontend to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the routers
app.include_router(topics.router)
app.include_router(generator.router)
app.include_router(users.router)

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