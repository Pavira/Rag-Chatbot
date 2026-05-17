import io
import re
import fitz

from docx import Document


class DocumentService:

    def extract_text(self, file_bytes: bytes, extension: str) -> str:
        """
        Extract text based on document type.
        """

        if extension == ".pdf":
            return self._extract_pdf_text(file_bytes)

        elif extension == ".docx":
            return self._extract_docx_text(file_bytes)

        raise ValueError("Unsupported document type.")

    # ------------------------------------------------------------------ #
    # PDF EXTRACTION
    # ------------------------------------------------------------------ #

    def _extract_pdf_text(self, file_bytes: bytes) -> str:
        """
        Extract text from PDF using PyMuPDF.
        """

        pdf = fitz.open(stream=file_bytes, filetype="pdf")

        pages = []

        for page_number, page in enumerate(pdf):

            text = page.get_text("text")

            cleaned_text = self._clean_text(text)

            if cleaned_text:
                pages.append(
                    f"=== PAGE {page_number + 1} START ===\n"
                    f"{cleaned_text}\n"
                    f"=== PAGE {page_number + 1} END ==="
                )

        pdf.close()

        return "\n\n".join(pages)

    # ------------------------------------------------------------------ #
    # DOCX EXTRACTION
    # ------------------------------------------------------------------ #

    def _extract_docx_text(self, file_bytes: bytes) -> str:
        """
        Extract text from DOCX using python-docx.
        """

        document = Document(io.BytesIO(file_bytes))

        content = []

        for paragraph in document.paragraphs:

            text = paragraph.text.strip()

            if text:
                cleaned_text = self._clean_text(text)

                content.append(cleaned_text)

        return "\n".join(content)

    # ------------------------------------------------------------------ #
    # TEXT CLEANING
    # ------------------------------------------------------------------ #

    def _clean_text(self, text: str) -> str:
        """
        Normalize extracted text for better chunking and embeddings.
        """

        if not text:
            return ""

        # Remove excessive whitespace
        text = re.sub(r"\s+", " ", text)

        # Normalize newlines
        text = re.sub(r"\n\s*\n+", "\n\n", text)

        # Remove invisible characters
        text = text.replace("\x00", "")

        return text.strip()


document_service = DocumentService()
