# RAG Backend (Agentic Resume QA)

FastAPI backend for resume-focused RAG with:

- Hybrid retrieval: PGVector semantic search + BM25 keyword search + RRF fusion
- Agentic answer generation: LangChain tool-calling agent using Gemini
- Session memory: chat sessions and message history in PostgreSQL
- Document ingestion: PDF/DOCX parsing, chunking, embeddings, and storage

## Tech Stack

- FastAPI
- PostgreSQL + PGVector
- SQLAlchemy (async)
- LangChain
- Google Gemini (`gemini-2.5-flash`)
- Gemini embeddings (`gemini-embedding-2`)
- BM25 (`rank-bm25`)

---

## Project Structure

```
app/
├── main.py
├── api/
│   └── routes/
│       ├── rag_chat.py       # POST /rag/chat
│       ├── rag_upload.py     # POST /rag/upload
│       └── session.py        # POST/DELETE /rag/session
├── core/
│   ├── config.py             # Settings from .env
│   └── database.py           # Async SQLAlchemy engine + init
├── services/
│   ├── document_service.py   # PDF/DOCX text extraction
│   ├── chunking_service.py   # RecursiveCharacterTextSplitter
│   ├── embedding_service.py  # Gemini embeddings
│   ├── vector_service.py     # PGVector similarity search
│   ├── bm25_service.py       # BM25 keyword search
│   ├── retrieval_service.py  # Hybrid retrieval with RRF
│   ├── llm_service.py        # Gemini LLM response generation
│   └── memory_service.py     # Session-based chat memory
├── models/                   # SQLAlchemy ORM models
├── schemas/                  # Pydantic request/response schemas
└── utils/
    └── helpers.py            # Context formatting utilities
```

---

## Prerequisites

- Python 3.11+
- PostgreSQL 14+ with **PGVector extension** installed
- Gemini API key

---

## Setup

### 1. Clone and install dependencies

```bash
cd rag_backend
uv venv
.venv/bin/activate        # Windows: venv\Scripts\activate
uv pip install -r requirements.txt
```

### 2. Create PostgreSQL database

```sql
CREATE DATABASE rag_db;
```

### 3. Configure environment variables

Edit `.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/rag_db
Gemini_API_KEY=your_Gemini_api_key_here
```

### 4. Run the server

```bash
uvicorn app.main:app --reload
```

## API Reference

### Health Check

```
GET /health
```

---

### 1. Upload PDF

```
POST /rag/upload
Content-Type: multipart/form-data

file: <PDF/DOCX file>
```

**Response:**

```json
{
  "success": true,
  "document_id": "uuid",
  "document_name": "example.pdf",
  "total_chunks": 42,
  "message": "PDF uploaded and processed successfully. 42 chunks stored."
}
```

---

### 2. Chat

```
POST /rag/chat
Content-Type: application/json

{
  "session_id": "optional-existing-session-id",
  "question": "What is the refund policy?"
}
```

**Response:**

```json
{
  "session_id": "uuid",
  "question": "What is the refund policy?",
  "answer": "According to the document, the refund policy...",
  "sources": ["policy.pdf"]
}
```

---

### 3. Create Session

```
POST /rag/session
```

**Response:**

```json
{
  "session_id": "uuid",
  "message": "Chat session created successfully."
}
```

---

### 4. Delete Session

```
DELETE /rag/session/{session_id}
```

**Response:**

```json
{
  "success": true,
  "message": "Session uuid and all its messages have been deleted."
}
```

## Architecture

### Document Ingestion Flow

```
PDF Upload → Extract Text (pypdf) → Recursive Chunking (500/50)
DOCX Upload → Extract Text (python-docx) → Recursive Chunking (500/50)
→ Gemini Embeddings → Store in PostgreSQL (documents + document_chunks)
```

### Chat Flow

```
Question → Gemini Embedding → Hybrid Retrieval
  ├── Vector Search (PGVector cosine similarity)
  └── BM25 Keyword Search
→ Reciprocal Rank Fusion (merge results)
→ Format Context → Load Chat History → Gemini LLM → Return Answer
→ Save to chat_messages
```

### Database Tables

| Table             | Purpose                                    |
| ----------------- | ------------------------------------------ |
| `documents`       | Stores PDF metadata (id, name, created_at) |
| `document_chunks` | Stores text chunks + 1536-dim embeddings   |
| `chat_sessions`   | Tracks active chat sessions                |
| `chat_messages`   | Temporary per-session conversation history |

---

## Configuration

All tunable parameters are in `.env` / `config.py`:

| Variable          | Default              | Description            |
| ----------------- | -------------------- | ---------------------- |
| `CHUNK_SIZE`      | 500                  | Characters per chunk   |
| `CHUNK_OVERLAP`   | 50                   | Overlap between chunks |
| `TOP_K_VECTOR`    | 5                    | Vector search results  |
| `TOP_K_BM25`      | 5                    | BM25 search results    |
| `TOP_K_FINAL`     | 5                    | Final merged results   |
| `GEMINI_MODEL`    | `gemini-2.5.flash`   | Gemini model name      |
| `EMBEDDING_MODEL` | `gemini-embedding-2` | Gemini embedding model |
