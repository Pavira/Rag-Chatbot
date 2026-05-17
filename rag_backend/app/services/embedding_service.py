from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd

from google import genai
from google.genai import types

from rag_backend.app.core.config import settings


class EmbeddingService:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def embed_texts(
        self,
        texts: list[str],
    ) -> tuple[list[list[float]], list[list[float]]]:
        """
        Generate embeddings for document chunks.
        """

        if not texts:
            return [], []

        embeddings = []

        try:
            for text in texts:
                response = self.client.models.embed_content(
                    model=settings.EMBEDDING_MODEL,
                    contents=text,
                    config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
                )

                embeddings.append(response.embeddings[0].values)

            print(f"Generated {len(embeddings)} embeddings")

            # Convert to similarity matrix
            similarity_matrix = cosine_similarity(embeddings)

            print(f"Similarity matrix shape: " f"{similarity_matrix.shape}")

            # Create DataFrame
            df = pd.DataFrame(
                similarity_matrix,
                index=[f"Chunk {i+1}" for i in range(len(embeddings))],
                columns=[f"Chunk {i+1}" for i in range(len(embeddings))],
            )

            print("\nChunk Similarity Matrix:\n")
            print(df)

            return embeddings, similarity_matrix.tolist()

        except Exception as e:
            raise Exception(f"Embedding generation failed: {str(e)}")

    async def embed_query(
        self,
        query: str,
    ) -> list[float]:
        """
        Generate embedding for query.
        """

        try:
            response = self.client.models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=query,
                config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
            )

            return response.embeddings[0].values

        except Exception as e:
            raise Exception(f"Query embedding failed: {str(e)}")


embedding_service = EmbeddingService()
