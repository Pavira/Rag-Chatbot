from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.tools import tool

from rag_backend.app.services.retrieval_service import retrieval_service
from rag_backend.app.utils.helpers import format_context


def build_hybrid_retrieval_tool(
    db: AsyncSession,
    query_embedding: list[float],
):
    """
    Build a LangChain-compatible hybrid retrieval tool.

    This tool preserves the existing RAG architecture by reusing:
    - retrieval_service.hybrid_retrieve()
    - format_context()

    IMPORTANT:
    Embeddings are generated OUTSIDE the tool to avoid:
    - repeated embedding API calls
    - Gemini quota exhaustion
    - unnecessary latency

    Args:
        db:
            Active async SQLAlchemy database session.

        query_embedding:
            Precomputed embedding for the user query.

    Returns:
        LangChain-compatible async retrieval tool.
    """

    @tool("hybrid_retrieval", return_direct=False)
    async def hybrid_retrieval_tool(question: str) -> str:
        """
        Retrieve grounded resume context using hybrid retrieval.

        Uses:
        - PGVector semantic similarity
        - BM25 keyword retrieval
        - Reciprocal Rank Fusion (RRF)

        Args:
            question:
                User question.

        Returns:
            Formatted grounded context string.
            Returns empty string if no relevant chunks exist.
        """

        # Normalize question
        normalized_question = question.strip()

        if not normalized_question:
            return ""

        # Run hybrid retrieval
        chunks = await retrieval_service.hybrid_retrieve(
            db=db,
            query=normalized_question,
            query_embedding=query_embedding,
        )

        # No results found
        if not chunks:
            return ""

        # Format retrieved chunks into LLM-ready context
        context = format_context(chunks)

        return context

    return hybrid_retrieval_tool
