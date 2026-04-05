import os
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Import the exception handlers
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Import the Redis-backed limiter we defined in the generator route
from routes.generator import limiter 

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

# --- REGISTER REDIS LIMITER ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Clean the URL and provide multiple safe fallbacks
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

app.add_middleware(
    CORSMiddleware,
    # Allow the exact frontend URL, plus localhost for your own testing
    allow_origins=[FRONTEND_URL, "http://localhost:3000"], 
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
        return {"status": "success", "message": "Database connection is working!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}