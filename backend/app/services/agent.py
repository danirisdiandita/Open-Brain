"""ReAct agent for complex multi-step RAG queries.

Enabled via RAG_AGENT_ENABLED=true.
"""

import json
import uuid

from app.config import get_settings
from app.services.embedding import embed_text
from app.services.vector_store import get_vector_store


async def _search_knowledge_base(
    db, query: str, org_id: uuid.UUID, top_k: int = 5,
) -> str:
    """Tool: semantic search over the knowledge base."""
    embedding = await embed_text(query)
    store = get_vector_store()
    results = await store.search(db, embedding, org_id, top_k=top_k, query_text=query)
    if not results:
        return "No relevant information found."
    return json.dumps([
        {"title": r.get("note_title", ""), "content": r.get("content", ""), "score": round(r.get("similarity", 0), 3)}
        for r in results
    ], indent=2)


async def run_agent(
    db,
    question: str,
    org_id: uuid.UUID,
    history: str = "",
) -> dict:
    """Run ReAct agent with tools. Falls back to single-step RAG if agent fails."""
    settings = get_settings()

    from langchain_openai import ChatOpenAI
    from langchain_core.messages import SystemMessage
    from langchain.agents import create_react_agent
    from langchain.tools import tool

    @tool
    def search_kb(query: str) -> str:
        """Search the Open Brain knowledge base for relevant documents.
        Use this for any factual questions about the organization's content."""
        import asyncio
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(_search_knowledge_base(db, query, org_id))

    @tool
    def list_topics() -> str:
        """List available knowledge base topics/folders."""
        return "Use search_kb to find specific information."

    tools = [search_kb, list_topics]

    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.2,
    )

    system = f"""You are an assistant for Open Brain, a knowledge base.
Use the search_kb tool to find relevant information before answering.
Always cite sources when providing information.
Be concise and helpful.

Conversation history:
{history or '(none)'}"""

    try:
        agent = create_react_agent(llm, tools)
        result = await agent.ainvoke({
            "input": question,
            "messages": [SystemMessage(content=system)],
        })
        output = result.get("output", "")
        return {"answer": str(output), "sources": [], "agent": True}
    except Exception:
        return None
