from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import init_db
from app.api.routes import rag_upload, rag_chat, session

# Import all models so SQLAlchemy registers them before init_db
import app.models.document  # noqa
import app.models.chunk  # noqa
import app.models.chat_session  # noqa
import app.models.chat_message  # noqa


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables on startup."""
    await init_db()
    yield


app = FastAPI(
    title="RAG Chatbot API",
    description="Production-style RAG chatbot backend with hybrid retrieval.",
    version="1.0.0",
    # lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(rag_upload.router, prefix="/rag", tags=["Document Ingestion"])
app.include_router(rag_chat.router, prefix="/rag", tags=["Chat"])
app.include_router(session.router, prefix="/rag", tags=["Session"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "message": "RAG Chatbot API is running."}
