import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from rag_backend.app.models.chat_session import ChatSession
from rag_backend.app.models.chat_message import ChatMessage


class MemoryService:
    async def create_session(self, db: AsyncSession, name: str | None) -> str:
        """Create a new chat session and return its ID."""
        normalized_name = (name or "").strip()

        result = await db.execute(
            select(ChatSession).where(ChatSession.name == normalized_name)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing.id

        session = ChatSession(id=str(uuid.uuid4()), name=normalized_name)
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session.id

    async def get_session(
        self, db: AsyncSession, session_id: str | None
    ) -> ChatSession:
        """Return an existing session, or create a new one when missing/invalid."""
        if session_id:
            result = await db.execute(
                select(ChatSession).where(ChatSession.id == session_id)
            )
            existing = result.scalar_one_or_none()
            if existing:
                return existing

        session = ChatSession(id=str(uuid.uuid4()), name="New Chat")
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    async def add_message(
        self, db: AsyncSession, session_id: str, role: str, content: str
    ) -> None:
        """Add a message to the chat history."""
        message = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
        )
        db.add(message)
        await db.commit()

    async def get_history(self, db: AsyncSession, session_id: str) -> list[dict]:
        """Retrieve ordered chat history for a session."""
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
        )
        messages = result.scalars().all()
        return [{"role": m.role, "content": m.content} for m in messages]

    async def delete_session(self, db: AsyncSession, session_id: str) -> bool:
        """Delete a session and all its messages."""
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            return False

        await db.execute(
            delete(ChatMessage).where(ChatMessage.session_id == session_id)
        )
        await db.execute(delete(ChatSession).where(ChatSession.id == session_id))
        await db.commit()
        return True


memory_service = MemoryService()
