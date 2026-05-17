import uuid
from pathlib import Path
from datetime import datetime, timezone
import io
import zipfile
import xml.etree.ElementTree as ET

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import fitz
from docx import Document as DocxDocument

from rag_backend.app.core.database import get_db
from rag_backend.app.models.document import Document
from rag_backend.app.models.chunk import DocumentChunk
from rag_backend.app.schemas.upload import UploadResponse
from rag_backend.app.core.config import settings
from rag_backend.app.services.document_service import document_service
from rag_backend.app.services.chunking_service import chunking_service
from rag_backend.app.services.embedding_service import embedding_service

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".docx"}


def _get_docx_page_count(file_bytes: bytes) -> int | None:
    """
    Read DOCX extended properties (docProps/app.xml) and return page count
    when available. Returns None when the property is missing/unreliable.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            app_xml = zf.read("docProps/app.xml")
        root = ET.fromstring(app_xml)
        pages_node = root.find(".//{*}Pages")
        if pages_node is None or not pages_node.text:
            return None
        pages = int(pages_node.text.strip())
        return pages if pages > 0 else None
    except Exception:
        return None


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload and process PDF/DOCX documents for RAG ingestion.
    """
    started_at = datetime.now(timezone.utc)

    # Validate filename
    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    extension = Path(file.filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported.",
        )

    # Read file bytes
    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    # Calculate page count metadata
    try:
        if extension == ".pdf":
            pdf = fitz.open(stream=file_bytes, filetype="pdf")
            total_pages = len(pdf)
            pdf.close()
        elif extension == ".docx":
            # DOCX page count comes from extended document properties when present.
            total_pages = _get_docx_page_count(file_bytes)
        else:
            total_pages = None
    except Exception:
        total_pages = None

    # Extract text
    try:
        extracted_text = document_service.extract_text(
            file_bytes=file_bytes,
            extension=extension,
        )

    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Document extraction failed: {str(e)}",
        )

    if not extracted_text.strip():
        raise HTTPException(
            status_code=422,
            detail="No text could be extracted from document.",
        )

    # Chunk text
    chunks = chunking_service.split_text(extracted_text)

    extracted_chucks = [
        chunk.page_content for chunk in chunks
    ]  # chunk.page_content for chunk in chunks
    # for i, chunk in enumerate(chunks):
    #     print(f"Chunk {i+1}: {chunk}...")

    if not chunks:
        raise HTTPException(
            status_code=422,
            detail="Document could not be chunked.",
        )

    # Generate embeddings
    try:
        embeddings, similarity_matrix = await embedding_service.embed_texts(
            extracted_chucks
        )

        print(f"Generated {len(embeddings)} embeddings for {len(chunks)} chunks.")

        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            print(
                f"Chunk {i+1}: "
                f"{chunk.page_content[:50]}... "
                f"| Embedding: {embedding[:5]}..."
            )

    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Embedding generation failed: {str(e)}",
        )

    # Store document
    document_id = str(uuid.uuid4())

    document = Document(
        id=document_id,
        name=file.filename,
    )

    db.add(document)
    await db.flush()

    # Store chunks
    for chunk_text, embedding in zip(extracted_chucks, embeddings):
        chunk = DocumentChunk(
            document_id=document_id,
            document_name=file.filename,
            chunk_text=chunk_text,
            embedding=embedding,
        )

        db.add(chunk)

    await db.commit()

    completed_at = datetime.now(timezone.utc)
    processing_time_seconds = round((completed_at - started_at).total_seconds(), 3)

    return UploadResponse(
        success=True,
        message=f"Document uploaded and processed successfully. {len(chunks)} chunks stored.",
        metadata={
            "document_id": document_id,
            "document_name": file.filename,
            "total_pages": total_pages,
            "total_chunks": len(chunks),
            "embedding_model": settings.EMBEDDING_MODEL,
            "chunk_size": settings.CHUNK_SIZE,
            "chunk_overlap": settings.CHUNK_OVERLAP,
            "processing_time_seconds": processing_time_seconds,
            "upload_timestamp": completed_at.isoformat(),
            "db_storage_status": "stored",
        },
        processing_stages=[
            "Uploading document",
            "Extracting text from document",
            "Cleaning and preprocessing content",
            "Creating chunks",
            "Generating embeddings",
            "Calculating similarity matrix",
            "Storing embeddings in PostgreSQL",
            "Finalizing indexing",
        ],
        similarity_matrix=similarity_matrix,
    )
