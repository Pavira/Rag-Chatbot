from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.memory_service import memory_service
from app.schemas.chat import SessionDeleteResponse, SessionCreateResponse

router = APIRouter()


class SessionRequest(BaseModel):
    name: str


@router.post("/session", response_model=SessionCreateResponse)
async def create_session(payload: SessionRequest, db: AsyncSession = Depends(get_db)):
    """Create a new chat session."""
    session_id = await memory_service.create_session(db, name=payload.name)

    return SessionCreateResponse(
        session_id=session_id,
        message="Chat session created successfully.",
    )


@router.delete("/session/{session_id}", response_model=SessionDeleteResponse)
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """
    Delete a chat session and all its messages.
    Call this when the user closes the chatbot.
    """
    deleted = await memory_service.delete_session(db, session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found.")

    return SessionDeleteResponse(
        success=True,
        message=f"Session {session_id} and all its messages have been deleted.",
    )


@router.get("/chat_history/{session_id}")
async def get_chat_history(session_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve the chat history for a specific session."""
    history = await memory_service.get_history(db, session_id=session_id)
    return history
