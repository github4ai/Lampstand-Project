import json
import traceback
from collections.abc import Iterator
from typing import Any

from fastapi import (
    APIRouter,
    HTTPException,
    status,
)
from fastapi.responses import StreamingResponse

from AIOS.Agents import agent_registry
from AIOS.Config import settings
from AIOS.LLM.ollama_client import OllamaClient
from AIOS.Orchestrator import AIOrchestrator
from AIOS.api.models import AskRequest


router = APIRouter(
    tags=["AI Streaming"],
)

orchestrator = AIOrchestrator()

MIN_RERANK_SCORE = -5.0
MAX_GROUNDED_RESULTS = 4


def encode_event(
    event_type: str,
    **payload: Any,
) -> str:
    """
    Encode one newline-delimited JSON streaming event.
    """

    event = {
        "type": event_type,
        **payload,
    }

    return (
        json.dumps(
            event,
            ensure_ascii=False,
        )
        + "\n"
    )


def resolve_agent_settings(
    request: AskRequest,
) -> tuple[str, int, float, str, str, str]:
    """
    Resolve settings from the selected agent.

    Returns:
        agent_id
        category
        top_k
        temperature
        model
        system_prompt
    """

    if request.agent_id is None:
        return (
            "default",
            request.category,
            request.top_k,
            settings.ollama.temperature,
            settings.ollama.model,
            "",
        )

    agent = agent_registry.require(
        request.agent_id
    )

    return (
        agent.id,
        agent.category,
        agent.top_k,
        agent.temperature,
        agent.model,
        agent.system_prompt,
    )


def filter_relevant_results(
    results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Keep results that pass the raw reranker threshold.
    """

    relevant_results: list[dict[str, Any]] = []

    for item in results:
        rerank_score = item.get(
            "rerank_score"
        )

        if isinstance(
            rerank_score,
            bool,
        ):
            continue

        if not isinstance(
            rerank_score,
            (int, float),
        ):
            continue

        if float(rerank_score) < MIN_RERANK_SCORE:
            continue

        relevant_results.append(
            item
        )

    relevant_results.sort(
        key=lambda item: float(
            item.get(
                "rerank_score",
                float("-inf"),
            )
        ),
        reverse=True,
    )

    return relevant_results[
        :MAX_GROUNDED_RESULTS
    ]


def build_source_metadata(
    results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Build frontend-safe source metadata.
    """

    sources: list[dict[str, Any]] = []

    for index, item in enumerate(
        results,
        start=1,
    ):
        source = item.get(
            "source",
            "Unknown source",
        )

        citation = item.get(
            "citation"
        )

        page = item.get(
            "page"
        )

        chunk = item.get(
            "chunk"
        )

        rerank_score = item.get(
            "rerank_score"
        )

        if not citation:
            citation_parts = [
                str(source)
            ]

            if page is not None:
                citation_parts.append(
                    f"Page {page}"
                )

            if chunk is not None:
                citation_parts.append(
                    f"Chunk {chunk}"
                )

            citation = " • ".join(
                citation_parts
            )

        sources.append(
            {
                "id": index,
                "citation": citation,
                "source": source,
                "page": page,
                "chunk": chunk,
                "rerank_score": (
                    float(rerank_score)
                    if isinstance(
                        rerank_score,
                        (int, float),
                    )
                    and not isinstance(
                        rerank_score,
                        bool,
                    )
                    else None
                ),
            }
        )

    return sources


def build_context(
    results: list[dict[str, Any]],
) -> str:
    """
    Build labelled source context for the LLM.
    """

    sections: list[str] = []

    for index, item in enumerate(
        results,
        start=1,
    ):
        text = item.get(
            "text",
            "",
        )

        if not isinstance(
            text,
            str,
        ):
            text = str(text)

        normalized_text = (
            text.strip()
        )

        if not normalized_text:
            continue

        citation = item.get(
            "citation"
        )

        if not citation:
            source = item.get(
                "source",
                "Unknown source",
            )

            chunk = item.get(
                "chunk"
            )

            citation = str(source)

            if chunk is not None:
                citation = (
                    f"{citation} • "
                    f"Chunk {chunk}"
                )

        sections.append(
            (
                f"[Source {index}: "
                f"{citation}]\n"
                f"{normalized_text}"
            )
        )

    return "\n\n".join(
        sections
    )


def build_grounded_prompt(
    system_prompt: str,
    question: str,
    context: str,
) -> str:
    """
    Build a strict citation-aware RAG prompt.
    """

    sections: list[str] = []

    normalized_system_prompt = (
        system_prompt.strip()
    )

    if normalized_system_prompt:
        sections.append(
            (
                "AGENT INSTRUCTIONS\n"
                "==================\n"
                f"{normalized_system_prompt}"
            )
        )

    sections.append(
        (
            "STRICT GROUNDING RULES\n"
            "======================\n"
            "Answer only from the supplied sources.\n\n"
            "Do not use general knowledge to fill gaps.\n\n"
            "Do not introduce Bible references, teachings, "
            "interpretations, facts, or conclusions unless they "
            "are explicitly supported by the supplied source text.\n\n"
            "Place a source label such as [Source 1] immediately "
            "after every important factual or doctrinal statement.\n\n"
            "Only cite source labels that appear in the supplied "
            "context.\n\n"
            "If the sources do not support part of the question, "
            "state that clearly."
        )
    )

    sections.append(
        (
            "SUPPLIED SOURCES\n"
            "================\n"
            f"{context}"
        )
    )

    sections.append(
        (
            "USER QUESTION\n"
            "=============\n"
            f"{question.strip()}"
        )
    )

    sections.append(
        (
            "SOURCE-GROUNDED ANSWER\n"
            "======================\n"
        )
    )

    return "\n\n".join(
        sections
    )


@router.post(
    "/ask/stream",
    response_class=StreamingResponse,
    summary="Stream a structured grounded response",
    description=(
        "Retrieve relevant sources, reject unsupported "
        "questions, and stream JSON events containing "
        "metadata, answer chunks, sources, and completion."
    ),
)
def ask_stream(
    request: AskRequest,
) -> StreamingResponse:
    """
    Stream a citation-aware RAG answer as NDJSON events.
    """

    try:
        question = (
            request.question.strip()
        )

        if not question:
            raise ValueError(
                "Question cannot be empty."
            )

        (
            agent_id,
            category,
            top_k,
            temperature,
            model,
            system_prompt,
        ) = resolve_agent_settings(
            request
        )

        search_results = (
            orchestrator.container.search_service.search(
                query=question,
                category=category,
                top_k=top_k,
            )
        )

        relevant_results = (
            filter_relevant_results(
                search_results
            )
        )

        source_metadata = (
            build_source_metadata(
                relevant_results
            )
        )

        def generate_events() -> Iterator[str]:
            yield encode_event(
                "metadata",
                agent_id=agent_id,
                category=category,
                model=model,
                grounded=bool(
                    relevant_results
                ),
                source_count=len(
                    source_metadata
                ),
                sources=source_metadata,
            )

            if not relevant_results:
                yield encode_event(
                    "chunk",
                    content=(
                        "The selected knowledge base "
                        "does not contain enough relevant "
                        "information to answer this question."
                    ),
                )

                yield encode_event(
                    "done",
                    grounded=False,
                )

                return

            context = build_context(
                relevant_results
            )

            if not context:
                yield encode_event(
                    "chunk",
                    content=(
                        "The retrieved sources contained "
                        "no usable text."
                    ),
                )

                yield encode_event(
                    "done",
                    grounded=False,
                )

                return

            prompt = build_grounded_prompt(
                system_prompt=system_prompt,
                question=question,
                context=context,
            )

            client = OllamaClient(
                model=model,
                host=settings.ollama.host,
                timeout=settings.ollama.timeout,
                num_predict=(
                    settings.ollama.num_predict
                ),
            )

            try:
                for fragment in client.stream(
                    prompt=prompt,
                    temperature=temperature,
                ):
                    yield encode_event(
                        "chunk",
                        content=fragment,
                    )

                yield encode_event(
                    "done",
                    grounded=True,
                )

            except Exception as exc:
                traceback.print_exc()

                yield encode_event(
                    "error",
                    message=str(exc),
                )

                yield encode_event(
                    "done",
                    grounded=True,
                    completed=False,
                )

        return StreamingResponse(
            generate_events(),
            media_type=(
                "application/x-ndjson"
            ),
            headers={
                "Cache-Control": "no-cache",
                "X-Content-Type-Options": (
                    "nosniff"
                ),
            },
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=str(exc),
        ) from exc

    except Exception as exc:
        traceback.print_exc()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=str(exc),
        ) from exc