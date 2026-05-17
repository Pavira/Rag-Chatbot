import logging
import traceback

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

from app.services.embedding_service import embedding_service
from app.services.llm_service import llm_service
from app.services.memory_service import memory_service

from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter()

# ==========================================================
# Logger Configuration
# ==========================================================
logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Agentic Resume RAG Chat Endpoint.

    Architecture Flow:
    -------------------------------------------------
    User Question
        ↓
    Session + Memory
        ↓
    Query Embedding
        ↓
    LangChain Agent
        ↓
    Retrieval Tool (@tool)
        ↓
    Hybrid Retrieval
        ↓
    Gemini LLM
        ↓
    Grounded Resume Response
        ↓
    Save Conversation Memory
    -------------------------------------------------
    """

    logger.info("================================================")
    logger.info("NEW CHAT REQUEST RECEIVED")
    logger.info("================================================")

    logger.info(f"Question: {request.question}")
    logger.info(f"Incoming Session ID: {request.session_id}")

    try:

        # ==========================================================
        # STEP 0: Validate Question
        # ==========================================================
        logger.info("STEP 0 → Validating User Question")

        normalized_question = request.question.strip()

        if not normalized_question:
            logger.warning("Validation Failed → Empty question")

            raise HTTPException(
                status_code=400,
                detail="Question cannot be empty.",
            )

        logger.info("Question validation successful")

        # ==========================================================
        # STEP 2: Fetch Conversation History
        # ==========================================================
        logger.info("STEP 2 → Fetching Conversation History")

        try:
            history = await memory_service.get_history(
                db=db,
                session_id=request.session_id,
            )

            logger.info(
                f"Conversation history fetched successfully. "
                f"Total messages: {len(history)}"
            )

        except Exception as e:
            logger.error("History retrieval failed")
            logger.error(str(e))
            logger.error(traceback.format_exc())

            raise HTTPException(
                status_code=500,
                detail=f"History retrieval failed: {str(e)}",
            )

        # ==========================================================
        # STEP 3: Generate Query Embedding
        # ==========================================================
        logger.info("STEP 3 → Generating Query Embedding")

        try:
            query_embedding = await embedding_service.embed_query(normalized_question)

            logger.info("Query embedding generated successfully")

            logger.info(f"Embedding dimension: {len(query_embedding)}")

        except Exception as e:
            logger.error("Embedding generation failed")
            logger.error(str(e))
            logger.error(traceback.format_exc())

            raise HTTPException(
                status_code=502,
                detail=f"Embedding generation failed: {str(e)}",
            )

        # ==========================================================
        # STEP 4: Run Agentic RAG Pipeline
        # ==========================================================
        logger.info("STEP 4 → Running Agentic RAG Pipeline")

        logger.info(
            "Execution Flow → "
            "LLM Agent → Retrieval Tool → Hybrid Retrieval → Gemini Response"
        )

        try:
            answer = await llm_service.generate_response(
                db=db,
                question=normalized_question,
                query_embedding=query_embedding,
                history=history,
            )

            logger.info("Agentic grounded response generated successfully")

            logger.info(f"Generated answer length: {len(answer)}")

        except Exception as e:
            logger.error("Agent execution failed")
            logger.error(str(e))
            logger.error(traceback.format_exc())

            raise HTTPException(
                status_code=502,
                detail=f"Agent execution failed: {str(e)}",
            )

        # ==========================================================
        # STEP 5: Save Conversation Memory
        # ==========================================================
        logger.info("STEP 5 → Saving Conversation Memory")

        try:

            # Save User Question
            await memory_service.add_message(
                db=db,
                session_id=request.session_id,
                role="user",
                content=normalized_question,
            )

            logger.info("User message saved successfully")

            # Save Assistant Response
            await memory_service.add_message(
                db=db,
                session_id=request.session_id,
                role="assistant",
                content=answer,
            )

            logger.info("Assistant response saved successfully")

            logger.info("Conversation memory persisted successfully")

        except Exception as e:
            logger.error("Memory persistence failed")
            logger.error(str(e))
            logger.error(traceback.format_exc())

            raise HTTPException(
                status_code=500,
                detail=f"Memory saving failed: {str(e)}",
            )

        # ==========================================================
        # STEP 6: Return Response
        # ==========================================================
        logger.info("STEP 6 → Returning Final Response")

        logger.info("CHAT REQUEST COMPLETED SUCCESSFULLY")

        logger.info("================================================")

        return {
            "session_id": request.session_id,
            "question": normalized_question,
            "answer": answer,
            "sources": ["Pavithiran-Resume-RAG-optimized.docx"],
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error("UNHANDLED SERVER EXCEPTION")
        logger.error(str(e))
        logger.error(traceback.format_exc())

        raise HTTPException(
            status_code=500,
            detail=f"Internal Server Error: {str(e)}",
        )
