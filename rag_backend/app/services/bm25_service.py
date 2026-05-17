from rank_bm25 import BM25Okapi
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.chunk import DocumentChunk
from app.core.config import settings

DOCUMENT_ID = "dccdc53f-690e-4560-bde7-bbbc60f14ef9"


class BM25Service:
    async def keyword_search(
        self,
        db: AsyncSession,
        query: str,
        top_k: int = None,
    ) -> list[dict]:
        """Perform BM25 keyword search across all document chunks."""
        if top_k is None:
            top_k = settings.TOP_K_BM25

        # Fetch all chunks from DB
        result = await db.execute(
            select(
                DocumentChunk.id,
                DocumentChunk.document_id,
                DocumentChunk.document_name,
                DocumentChunk.chunk_text,
            )
        )
        rows = result.fetchall()

        if not rows:
            return []

        ids = [row.id for row in rows]
        document_ids = [row.document_id for row in rows]
        names = [row.document_name for row in rows]
        texts = [row.chunk_text for row in rows]

        # Tokenize
        tokenized_corpus = [text.lower().split() for text in texts]
        tokenized_query = query.lower().split()

        bm25 = BM25Okapi(tokenized_corpus)
        scores = bm25.get_scores(tokenized_query)

        # Get top_k indices
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[
            :top_k
        ]

        results = []
        for idx in top_indices:
            if scores[idx] > 0:
                results.append(
                    {
                        "id": ids[idx],
                        "document_id": str(document_ids[idx]),
                        "document_name": names[idx],
                        "chunk_text": texts[idx],
                        "score": float(scores[idx]),
                        "source": "bm25",
                    }
                )

        return results


bm25_service = BM25Service()
