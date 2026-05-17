from sqlalchemy.ext.asyncio import AsyncSession

from langchain.agents import (
    AgentExecutor,
    create_tool_calling_agent,
)

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from rag_backend.app.core.config import settings
from rag_backend.app.tools.rag_retrieval_tool import (
    build_hybrid_retrieval_tool,
)

SYSTEM_PROMPT = """
You are an AI Resume Assistant.

You MUST answer questions ONLY using the resume retrieval tool.

IMPORTANT RULES:
1. You MUST ALWAYS call the retrieval tool before answering.
2. You MUST answer ONLY using retrieved resume context.
3. Never use your own knowledge.
4. Never infer or assume information.
5. Never answer from conversation memory alone.
6. If retrieved context is missing OR insufficient,
   respond EXACTLY:
   "This information is not available in the provided CV."
7. Do NOT fabricate skills, projects, companies, dates, education, or experience.
8. Keep responses concise and professional.
9. Use retrieval tool only once per question.
"""


class LLMService:
    def __init__(self):

        self.llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.1,
        )

    def _format_history(
        self,
        history: list[dict],
    ) -> str:
        """
        Convert chat history into prompt-friendly text.
        """

        if not history:
            return "No previous conversation."

        formatted_history = []

        # Keep recent history only
        recent_history = history[-6:]

        for message in recent_history:

            role = message.get("role", "user")
            content = message.get("content", "")

            formatted_history.append(f"{role.upper()}: {content}")

        return "\n".join(formatted_history)

    async def generate_response(
        self,
        db: AsyncSession,
        question: str,
        query_embedding: list[float],
        history: list[dict],
    ) -> str:
        """
        Generate grounded agentic RAG response.
        """

        try:

            # ======================================================
            # Build Retrieval Tool
            # ======================================================
            retrieval_tool = build_hybrid_retrieval_tool(
                db=db,
                query_embedding=query_embedding,
            )

            tools = [retrieval_tool]

            # ======================================================
            # Format Conversation History
            # ======================================================
            history_text = self._format_history(history)

            print(f"Formatted conversation history:\n{history_text}")

            # ======================================================
            # Build Prompt
            # ======================================================
            prompt = ChatPromptTemplate.from_messages(
                [
                    (
                        "system",
                        SYSTEM_PROMPT,
                    ),
                    (
                        "human",
                        """
                    Conversation History:
                    {history}

                    Current User Question:
                    {input}
                        """,
                    ),
                    (
                        "placeholder",
                        "{agent_scratchpad}",
                    ),
                ]
            )

            # ======================================================
            # Create Tool Calling Agent
            # ======================================================
            agent = create_tool_calling_agent(
                llm=self.llm,
                tools=tools,
                prompt=prompt,
            )

            # ======================================================
            # Create Agent Executor
            # ======================================================
            agent_executor = AgentExecutor(
                agent=agent,
                tools=tools,
                verbose=True,
                handle_parsing_errors=True,
            )

            # ======================================================
            # Execute Agent
            # ======================================================
            response = await agent_executor.ainvoke(
                {
                    "input": question,
                    "history": history_text,
                }
            )

            output = response.get("output", "").strip()

            if not output:
                return "This information is not available " "in the provided CV."

            return output

        except Exception as e:
            raise Exception(f"LLM response generation failed: {str(e)}")


llm_service = LLMService()
