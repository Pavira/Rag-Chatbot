from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.config import settings

DOCUMENT_ID = "dccdc53f-690e-4560-bde7-bbbc60f14ef9"


class VectorService:
    async def similarity_search(
        self,
        db: AsyncSession,
        query_embedding: list[float],
        top_k: int = None,
    ) -> list[dict]:
        """Perform cosine similarity search using PGVector."""

        if top_k is None:
            top_k = settings.TOP_K_VECTOR

        # Convert embedding to pgvector string format
        embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

        query = text("""
            SELECT
                id,
                document_id,
                document_name,
                chunk_text,
                1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
            FROM document_chunks
            WHERE document_id = :document_id
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT :top_k
            """)

        result = await db.execute(
            query,
            {
                "embedding": embedding_str,
                "document_id": DOCUMENT_ID,
                "top_k": top_k,
            },
        )

        rows = result.fetchall()

        return [
            {
                "id": row.id,
                "document_name": row.document_name,
                "chunk_text": row.chunk_text,
                "score": float(row.similarity),
                "source": "vector",
            }
            for row in rows
        ]


vector_service = VectorService()
