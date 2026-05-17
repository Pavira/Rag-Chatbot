from pydantic import BaseModel


class UploadMetadata(BaseModel):
    document_id: str
    document_name: str
    total_pages: int | None
    total_chunks: int
    embedding_model: str
    chunk_size: int
    chunk_overlap: int
    processing_time_seconds: float
    upload_timestamp: str
    db_storage_status: str


class UploadResponse(BaseModel):
    success: bool
    message: str
    metadata: UploadMetadata
    processing_stages: list[str]
    similarity_matrix: list[list[float]]
