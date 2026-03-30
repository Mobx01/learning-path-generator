from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from models import schemas
from services.graph import generate_learning_path

router = APIRouter(
    tags=["Generator"]
)

# POST /generate-path
@router.post("/generate-path")
def generate_path(request: schemas.PathRequest, db: Session = Depends(get_db)):
    try:
        path = generate_learning_path(db, request.topic)
        return path
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))