from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document


class ChunkingService:

    def __init__(self):

        self.splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            chunk_size=500,
            chunk_overlap=50,
            separators=[
                "\n# ",
                "\n## ",
                "\n\n",
                "\n",
                ". ",
                " ",
            ],
        )

    def split_text(
        self,
        text: str,
        # metadata: dict | None = None,
    ) -> list[Document]:

        # metadata = metadata or {}

        docs = [
            Document(
                page_content=text,
                # metadata=metadata,
            )
        ]

        chunks = self.splitter.split_documents(docs)

        return chunks


chunking_service = ChunkingService()
