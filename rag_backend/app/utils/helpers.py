def format_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a context string for the LLM."""
    parts = []
    for i, chunk in enumerate(chunks, 1):
        source = chunk.get("document_name", "Unknown")
        text = chunk.get("chunk_text", "")
        parts.append(f"[Source {i}: {source}]\n{text}")
    return "\n\n---\n\n".join(parts)


def extract_sources(chunks: list[dict]) -> list[str]:
    """Extract unique document names from retrieved chunks."""
    seen = set()
    sources = []
    for chunk in chunks:
        name = chunk.get("document_name", "Unknown")
        if name not in seen:
            seen.add(name)
            sources.append(name)
    return sources
