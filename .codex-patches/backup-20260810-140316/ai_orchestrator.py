"""
AIOS Orchestrator

Coordinates the retrieval-augmented generation pipeline:

Question
↓
Conversation resolution
↓
Conversation-summary loading
↓
Recent conversation-history loading
↓
Retrieval-query resolution
↓
User-message storage
↓
Search
↓
Context preparation
↓
Prompt generation
↓
LLM generation
↓
Assistant-message storage
↓
Automatic conversation summarization
↓
Answer and sources
"""

from typing import Any

from AIOS.Container import ServiceContainer
from AIOS.Logging import logger
from AIOS.Memory import (
    ConversationManager,
    Message,
    conversation_manager,
)


class AIOrchestrator:
    """
    Coordinate AIOS services for conversational
    retrieval-augmented generation.
    """

    def __init__(
        self,
        container: Any | None = None,
        memory_manager: ConversationManager | None = None,
        summary_coordinator: Any | None = None,
        history_message_limit: int = 6,
    ) -> None:
        """
        Initialize the orchestrator.
        """

        if (
            isinstance(history_message_limit, bool)
            or not isinstance(history_message_limit, int)
        ):
            raise ValueError(
                "history_message_limit must be an integer."
            )

        if history_message_limit < 0:
            raise ValueError(
                "history_message_limit cannot be negative."
            )

        self.container = container or ServiceContainer()

        self.conversation_manager = (
            memory_manager or conversation_manager
        )

        if summary_coordinator is not None:
            self.summary_coordinator = summary_coordinator
        else:
            self.summary_coordinator = getattr(
                self.container,
                "summary_coordinator",
                None,
            )

        self.history_message_limit = history_message_limit

    def ask(
        self,
        question: str,
        category: str = "Ministry",
        top_k: int = 5,
        conversation_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Answer a question using indexed knowledge,
        conversation history, and stored summary memory.
        """

        question = self._validate_question(question)
        category = self._validate_category(category)
        top_k = self._validate_top_k(top_k)

        conversation_id = self._normalize_conversation_id(
            conversation_id
        )

        conversation = (
            self.conversation_manager.get_or_create_conversation(
                conversation_id
            )
        )

        resolved_conversation_id = (
            conversation.conversation_id
        )

        previous_messages = (
            self.conversation_manager.get_recent_messages(
                conversation_id=resolved_conversation_id,
                limit=self.history_message_limit,
            )
        )

        conversation_summary = (
            self.conversation_manager.get_summary(
                resolved_conversation_id
            )
        )

        conversation_history = (
            self._build_conversation_history(
                previous_messages
            )
        )

        formatted_conversation_summary = (
            self._build_conversation_summary(
                conversation_summary
            )
        )

        retrieval_query = self._build_retrieval_query(
            question=question,
            previous_messages=previous_messages,
            conversation_summary=conversation_summary,
        )
        logger.info("AI request started.")

        logger.info(
            (
                "ConversationId=%s | Question=%s | "
                "RetrievalQuery=%s | Category=%s | "
                "TopK=%s | HistoryMessages=%s | "
                "HasSummary=%s"
            ),
            resolved_conversation_id,
            question,
            retrieval_query,
            category,
            top_k,
            len(previous_messages),
            conversation_summary is not None,
        )

        self.conversation_manager.add_message(
            conversation_id=resolved_conversation_id,
            role="user",
            content=question,
        )

        try:
            results = self.container.search_service.search(
                query=retrieval_query,
                category=category,
                top_k=top_k,
            )

            if not results:
                logger.warning(
                    "No search results were returned."
                )

                answer = (
                    "The supplied context does not contain enough "
                    "information to answer this question."
                )

                self._store_assistant_message(
                    conversation_id=resolved_conversation_id,
                    answer=answer,
                )

                logger.info("AI request finished.")

                return {
                    "conversation_id": (
                        resolved_conversation_id
                    ),
                    "question": question,
                    "answer": answer,
                    "sources": [],
                }

            logger.info(
                "Retrieved %s result(s).",
                len(results),
            )

            context = self._build_context(results)

            if not context:
                logger.warning(
                    "Retrieved results contained no usable text."
                )

                answer = (
                    "The supplied context does not contain enough "
                    "information to answer this question."
                )

                self._store_assistant_message(
                    conversation_id=resolved_conversation_id,
                    answer=answer,
                )

                logger.info("AI request finished.")

                return {
                    "conversation_id": (
                        resolved_conversation_id
                    ),
                    "question": question,
                    "answer": answer,
                    "sources": self._build_sources(
                        results
                    ),
                }

            prompt = self.container.prompt_service.build(
                "rag",
                conversation_summary=(
                    formatted_conversation_summary
                ),
                conversation_history=(
                    conversation_history
                ),
                question=question,
                context=context,
            )

            draft_answer = (
                self.container.model_service.generate(
                    prompt
                )
            )

            if not isinstance(draft_answer, str):
                draft_answer = str(draft_answer)

            draft_answer = draft_answer.strip()

            if not draft_answer:
                draft_answer = (
                    "The language model did not return "
                    "an answer."
                )

            answer = self._ground_answer(
                question=question,
                context=context,
                draft_answer=draft_answer,
            )

            self._store_assistant_message(
                conversation_id=resolved_conversation_id,
                answer=answer,
            )

            logger.info("AI request finished.")

            return {
                "conversation_id": (
                    resolved_conversation_id
                ),
                "question": question,
                "answer": answer,
                "sources": self._build_sources(
                    results
                ),
            }

        except Exception:
            logger.exception(
                (
                    "AI request failed | "
                    "ConversationId=%s"
                ),
                resolved_conversation_id,
            )

            raise

    def _ground_answer(
        self,
        question: str,
        context: str,
        draft_answer: str,
    ) -> str:
        """
        Verify a generated answer against retrieved context.

        If no grounding service is configured, return the
        original draft answer.
        """

        grounding_service = getattr(
            self.container,
            "grounding_service",
            None,
        )

        if grounding_service is None:
            return draft_answer

        try:
            grounded_answer = (
                grounding_service.validate(
                    question=question,
                    context=context,
                    draft_answer=draft_answer,
                )
            )

            logger.info(
                (
                    "Grounding validation completed | "
                    "DraftCharacters=%s | "
                    "FinalCharacters=%s"
                ),
                len(draft_answer),
                len(grounded_answer),
            )

            return grounded_answer

        except Exception:
            logger.exception(
                "Grounding validation failed."
            )

            return draft_answer

    def _store_assistant_message(
        self,
        conversation_id: str,
        answer: str,
    ) -> None:
        """
        Store an assistant response and summarize
        the conversation when required.
        """

        normalized_answer = answer.strip()

        if not normalized_answer:
            return

        self.conversation_manager.add_message(
            conversation_id=conversation_id,
            role="assistant",
            content=normalized_answer,
        )

        self._summarize_conversation_if_needed(
            conversation_id
        )

    def _summarize_conversation_if_needed(
        self,
        conversation_id: str,
    ) -> str | None:
        """
        Generate and persist a conversation summary
        when the configured threshold is reached.

        Summary failures are logged but do not discard
        a valid assistant answer.
        """

        if self.summary_coordinator is None:
            return None

        try:
            summary = (
                self.summary_coordinator
                .summarize_if_needed(
                    conversation_id
                )
            )

            if summary:
                logger.info(
                    (
                        "Conversation summarized | "
                        "ConversationId=%s | "
                        "SummaryCharacters=%s"
                    ),
                    conversation_id,
                    len(summary),
                )

            return summary

        except Exception:
            logger.exception(
                (
                    "Conversation summarization failed | "
                    "ConversationId=%s"
                ),
                conversation_id,
            )

            return None

    @classmethod
    def _build_retrieval_query(
        cls,
        question: str,
        previous_messages: list[Message],
        conversation_summary: str | None = None,
    ) -> str:
        """
        Build a retrieval query for the current request.

        Context-dependent follow-ups use the stored summary and
        recent user messages to preserve the earlier subject.
        """

        if not cls._is_context_dependent_question(
            question
        ):
            return question

        context_sections: list[str] = []

        if isinstance(conversation_summary, str):
            normalized_summary = (
                conversation_summary.strip()
            )

            if normalized_summary:
                context_sections.append(
                    (
                        "Stored conversation context:\n"
                        f"{normalized_summary}"
                    )
                )

        previous_user_question = (
            cls._get_latest_user_message(
                previous_messages
            )
        )

        if previous_user_question:
            context_sections.append(
                (
                    "Most recent user message:\n"
                    f"{previous_user_question}"
                )
            )

        if not context_sections:
            return question

        context_sections.append(
            (
                "Current follow-up:\n"
                f"{question}"
            )
        )

        return "\n\n".join(
            context_sections
        )

    @staticmethod
    def _get_latest_user_message(
        messages: list[Message],
    ) -> str | None:
        """
        Return the most recent user message.
        """

        for message in reversed(messages):
            if message.role == "user":
                return message.content

        return None

    @staticmethod
    def _is_context_dependent_question(
        question: str,
    ) -> bool:
        """
        Identify questions that likely depend on
        prior conversation.

        Whole-word and whole-phrase matching prevents
        short reference words such as "it" from matching
        inside words such as "spirit".
        """

        normalized = " ".join(
            question.lower().strip().split()
        )

        words = normalized.split()
        word_set = set(words)

        exact_follow_ups = {
            "continue",
            "go on",
            "explain more",
            "tell me more",
            "summarize it",
            "summarize that",
            "make it shorter",
            "make that shorter",
            "give me a shorter explanation",
            "give a shorter explanation",
            "explain that",
            "explain it",
            "why",
            "how",
        }

        if normalized in exact_follow_ups:
            return True

        reference_words = {
            "it",
            "that",
            "this",
            "them",
            "those",
            "these",
        }

        if word_set.intersection(
            reference_words
        ):
            return True

        reference_phrases = {
            "the above",
            "previous answer",
            "previous explanation",
            "earlier answer",
            "earlier discussion",
            "our earlier discussion",
            "based on our discussion",
            "based on our earlier discussion",
            "discussion so far",
            "central point again",
            "main point again",
            "shorter explanation",
            "more detail",
            "simpler explanation",
            "what happened after",
            "what happened next",
            "why is that",
            "how does that",
            "compare it",
            "compare that",
        }

        if any(
            phrase in normalized
            for phrase in reference_phrases
        ):
            return True

        follow_up_starters = (
            "and ",
            "but ",
            "also ",
            "then ",
            "so ",
        )

        if (
            len(words) <= 12
            and normalized.startswith(
                follow_up_starters
            )
        ):
            return True

        return False

    @staticmethod
    def _build_conversation_summary(
        summary: str | None,
    ) -> str:
        """
        Format an optional stored conversation summary.
        """

        if summary is None:
            return (
                "No stored conversation summary."
            )

        if not isinstance(summary, str):
            summary = str(summary)

        normalized = summary.strip()

        if not normalized:
            return (
                "No stored conversation summary."
            )

        return normalized

    @staticmethod
    def _build_conversation_history(
        messages: list[Message],
    ) -> str:
        """
        Format recent messages for the RAG prompt.
        """

        if not messages:
            return "No previous conversation."

        history_sections: list[str] = []

        role_labels = {
            "user": "User",
            "assistant": "Assistant",
            "system": "System",
        }

        for message in messages:
            role_label = role_labels.get(
                message.role,
                message.role.title(),
            )

            content = message.content.strip()

            if not content:
                continue

            history_sections.append(
                f"{role_label}: {content}"
            )

        if not history_sections:
            return "No previous conversation."

        return "\n\n".join(
            history_sections
        )

    @staticmethod
    def _validate_question(
        question: str,
    ) -> str:
        """
        Validate and normalize a question.
        """

        if not isinstance(question, str):
            raise ValueError(
                "Question must be a string."
            )

        normalized = question.strip()

        if not normalized:
            raise ValueError(
                "Question cannot be empty."
            )

        return normalized

    @staticmethod
    def _validate_category(
        category: str,
    ) -> str:
        """
        Validate and normalize the knowledge category.
        """

        if not isinstance(category, str):
            raise ValueError(
                "Category must be a string."
            )

        normalized = category.strip()

        if not normalized:
            raise ValueError(
                "Category cannot be empty."
            )

        return normalized

    @staticmethod
    def _validate_top_k(
        top_k: int,
    ) -> int:
        """
        Validate the requested result count.
        """

        if (
            isinstance(top_k, bool)
            or not isinstance(top_k, int)
        ):
            raise ValueError(
                "top_k must be an integer."
            )

        if top_k < 1:
            raise ValueError(
                "top_k must be at least 1."
            )

        if top_k > 20:
            raise ValueError(
                "top_k cannot be greater than 20."
            )

        return top_k

    @staticmethod
    def _normalize_conversation_id(
        conversation_id: str | None,
    ) -> str | None:
        """
        Normalize an optional conversation identifier.
        """

        if conversation_id is None:
            return None

        if not isinstance(
            conversation_id,
            str,
        ):
            raise ValueError(
                "conversation_id must be "
                "a string or null."
            )

        normalized = conversation_id.strip()

        return normalized or None

    @staticmethod
    def _build_context(
        results: list[dict[str, Any]],
    ) -> str:
        """
        Convert retrieved results into structured
        source sections.
        """

        context_sections: list[str] = []

        for index, item in enumerate(
            results,
            start=1,
        ):
            citation = item.get("citation")

            if not citation:
                source = item.get(
                    "source",
                    "Unknown source",
                )

                chunk = item.get("chunk")

                if chunk is not None:
                    citation = (
                        f"{source} • Chunk {chunk}"
                    )
                else:
                    citation = str(source)

            text = item.get("text", "")

            if not isinstance(text, str):
                text = str(text)

            text = text.strip()

            if not text:
                continue

            context_sections.append(
                (
                    f"[Source {index}: "
                    f"{citation}]\n"
                    f"{text}"
                )
            )

        return "\n\n".join(
            context_sections
        )

    @staticmethod
    def _build_sources(
        results: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """
        Build compact source metadata for
        the API response.
        """

        sources: list[dict[str, Any]] = []

        for item in results:
            source_data = {
                "citation": item.get(
                    "citation"
                ),
                "source": item.get(
                    "source"
                ),
                "category": item.get(
                    "category"
                ),
                "page": item.get(
                    "page"
                ),
                "chunk": item.get(
                    "chunk"
                ),
                "score": item.get(
                    "score"
                ),
                "retrieval_score": item.get(
                    "retrieval_score"
                ),
                "fusion_score": item.get(
                    "fusion_score"
                ),
                "fusion_score_normalized": item.get(
                    "fusion_score_normalized"
                ),
                "rerank_score": item.get(
                    "rerank_score"
                ),
                "rerank_score_normalized": item.get(
                    "rerank_score_normalized"
                ),
                "combined_score": item.get(
                    "combined_score"
                ),
                "matched_queries": item.get(
                    "matched_queries"
                ),
                "retrieval_methods": item.get(
                    "retrieval_methods"
                ),
            }

            sources.append(
                source_data
            )

        return sources
