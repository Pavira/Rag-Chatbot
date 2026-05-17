from sqlalchemy.ext.asyncio import AsyncSession

from app.services.vector_service import vector_service
from app.services.bm25_service import bm25_service
from app.core.config import settings


class RetrievalService:

    async def hybrid_retrieve(
        self,
        db: AsyncSession,
        query: str,
        query_embedding: list[float],
    ) -> list[dict]:
        """
        Hybrid Retrieval:
        - PGVector semantic search
        - BM25 keyword search
        - Reciprocal Rank Fusion (RRF)
        """

        # ======================================================
        # Vector Search
        # ======================================================
        vector_results = await vector_service.similarity_search(
            db=db,
            query_embedding=query_embedding,
        )

        # ======================================================
        # BM25 Search
        # ======================================================
        bm25_results = await bm25_service.keyword_search(
            db=db,
            query=query,
        )

        # ======================================================
        # Reciprocal Rank Fusion
        # ======================================================

        def reciprocal_rank(
            rank: int,
            k: int = 60,
        ) -> float:
            return 1.0 / (k + rank + 1)

        rrf_scores: dict[str, float] = {}
        chunk_map: dict[str, dict] = {}

        # Vector scores
        for rank, chunk in enumerate(vector_results):

            chunk_id = chunk["id"]

            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + reciprocal_rank(rank)

            chunk_map[chunk_id] = chunk

        # BM25 scores
        for rank, chunk in enumerate(bm25_results):

            chunk_id = chunk["id"]

            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + reciprocal_rank(rank)

            chunk_map[chunk_id] = chunk

        # ======================================================
        # Sort Final Results
        # ======================================================
        sorted_chunk_ids = sorted(
            rrf_scores,
            key=lambda cid: rrf_scores[cid],
            reverse=True,
        )

        final_chunks = []

        for chunk_id in sorted_chunk_ids[: settings.TOP_K_FINAL]:

            chunk = chunk_map[chunk_id]

            chunk["rrf_score"] = rrf_scores[chunk_id]

            final_chunks.append(chunk)

        return final_chunks


retrieval_service = RetrievalService()
