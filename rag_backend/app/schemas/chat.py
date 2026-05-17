from pydantic import BaseModel
from typing import Optional


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    question: str
    name: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    question: str
    answer: str
    sources: list[str]


class SessionCreateResponse(BaseModel):
    session_id: str
    message: str


class SessionDeleteResponse(BaseModel):
    success: bool
    message: str
