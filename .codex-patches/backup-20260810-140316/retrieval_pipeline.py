"""
AIOS Retrieval Pipeline

Coordinates:

1. Concept-aware query expansion
2. Multi-query generation
3. Weighted query construction
4. Semantic retrieval
5. BM25 retrieval
6. Weighted Reciprocal Rank Fusion
7. Cross-encoder reranking
8. Combined fusion and reranker scoring
9. Context expansion
10. Context compression
11. Citation building
"""

from AIOS.Search.embedding_search import EmbeddingSearch
from AIOS.Search.hybrid_search import HybridSearch
from AIOS.Search.score_fusion import ReciprocalRankFusion
from AIOS.Search.query_expander import QueryExpander
from AIOS.Search.reranker import CrossEncoderReranker
from AIOS.Search.context_expander import ContextExpander
from AIOS.Search.context_compressor import ContextCompressor
from AIOS.Search.citation_builder import CitationBuilder
from AIOS.Search.multi_query_generator import MultiQueryGenerator


class RetrievalPipeline:
    """
    Executes the complete AIOS retrieval workflow.
    """

    def __init__(self, engine):

        self.engine = engine

        self.embedding = EmbeddingSearch(
            engine
        )

        self.hybrid = HybridSearch(
            engine
        )

        self.expander = QueryExpander()

        self.multi_query = MultiQueryGenerator()

        self.fusion = ReciprocalRankFusion()

        self.reranker = CrossEncoderReranker()

        self.context = ContextExpander(
            engine.store
        )

        self.compressor = ContextCompressor()

        self.citations = CitationBuilder()

        # Fusion remains the primary ranking signal.
        # Cross-encoder scores refine the final order.

        self.fusion_weight = 0.70

        self.rerank_weight = 0.30

    # ---------------------------------------------------------

    def search(
        self,
        query,
        category="Ministry",
        top_k=5
    ):
        """
        Search the indexed knowledge base.

        The original user question is expanded through:

        - concept YAML definitions
        - concept aliases
        - Scripture references
        - related concepts
        - multi-query generation

        Every generated query receives a weight.

        Semantic and BM25 results remain in separate ranked
        lists until Weighted Reciprocal Rank Fusion.

        The final order combines:

        - normalized weighted fusion score
        - normalized cross-encoder score
        """

        query = self._validate_query(
            query
        )

        top_k = self._validate_top_k(
            top_k
        )

        # -----------------------------------------------------
        # STEP 1
        # -----------------------------------------------------

        print()
        print("=" * 70)
        print("STEP 1 : CONCEPT QUERY EXPANSION")
        print("=" * 70)

        expansion = self.expander.expand(
            query=query,
            expand_concepts=True,
            expand_scriptures=True,
            expand_related=True,
            max_terms=12
        )

        concept_queries = expansion.get(
            "search_queries",
            [query]
        )

        print(
            "Matched concept:",
            expansion.get("concept")
        )

        for expanded_term in concept_queries:

            print(
                "-",
                expanded_term
            )

        # -----------------------------------------------------
        # STEP 2
        # -----------------------------------------------------

        print()
        print("=" * 70)
        print("STEP 2 : MULTI QUERY GENERATION")
        print("=" * 70)

        generated_queries = self.multi_query.generate(
            query
        )

        if not generated_queries:

            generated_queries = [
                query
            ]

        for generated_query in generated_queries:

            print(
                "-",
                generated_query
            )

        # -----------------------------------------------------
        # STEP 3
        # -----------------------------------------------------

        weighted_queries = self._build_weighted_queries(
            original_query=query,
            expansion=expansion,
            generated_queries=generated_queries
        )

        print()
        print("=" * 70)
        print("STEP 3 : WEIGHTED SEARCH QUERY SET")
        print("=" * 70)

        print(
            "Total unique queries:",
            len(weighted_queries)
        )

        for query_item in weighted_queries:

            print(
                "-",
                query_item["query"],
                "| weight:",
                query_item["weight"],
                "| type:",
                query_item["query_type"]
            )

        # -----------------------------------------------------
        # STEP 4
        # -----------------------------------------------------

        ranked_lists = []

        raw_semantic_count = 0

        raw_lexical_count = 0

        print()
        print("=" * 70)
        print("STEP 4 : SEMANTIC AND BM25 SEARCH")
        print("=" * 70)

        for query_item in weighted_queries:

            search_query = query_item[
                "query"
            ]

            query_weight = query_item[
                "weight"
            ]

            query_type = query_item[
                "query_type"
            ]

            print()
            print(
                "Searching:",
                search_query,
                "| weight:",
                query_weight,
                "| type:",
                query_type
            )

            query_vector = (
                self.engine
                .embedding_engine
                .encode(search_query)
            )

            semantic_results = self.embedding.search(
                query_vector=query_vector,
                category=category,
                top_k=10
            )

            lexical_results = self.hybrid.search(
                query=search_query,
                category=category,
                top_k=10
            )

            self._annotate_results(
                results=semantic_results,
                search_query=search_query,
                retrieval_method="semantic",
                query_weight=query_weight,
                query_type=query_type
            )

            self._annotate_results(
                results=lexical_results,
                search_query=search_query,
                retrieval_method="bm25",
                query_weight=query_weight,
                query_type=query_type
            )

            raw_semantic_count += len(
                semantic_results
            )

            raw_lexical_count += len(
                lexical_results
            )

            ranked_lists.append({
                "results": semantic_results,
                "query": search_query,
                "weight": query_weight,
                "method": "semantic"
            })

            # Exact lexical matches are especially valuable
            # for ministry terminology, Scripture references,
            # and exact concept names.

            ranked_lists.append({
                "results": lexical_results,
                "query": search_query,
                "weight": query_weight * 1.10,
                "method": "bm25"
            })

        print()
        print(
            "Raw semantic results:",
            raw_semantic_count
        )

        print(
            "Raw BM25 results:",
            raw_lexical_count
        )

        # -----------------------------------------------------
        # STEP 5
        # -----------------------------------------------------

        print()
        print("=" * 70)
        print("STEP 5 : WEIGHTED RESULT AGGREGATION")
        print("=" * 70)

        print(
            "Ranked lists:",
            len(ranked_lists)
        )

        # -----------------------------------------------------
        # STEP 6
        # -----------------------------------------------------

        print()
        print("=" * 70)
        print("STEP 6 : WEIGHTED RECIPROCAL RANK FUSION")
        print("=" * 70)

        merged = self.fusion.fuse(
            *ranked_lists
        )

        print(
            "Fused results:",
            len(merged)
        )

        print()
        print("Top weighted-fusion candidates:")

        for item in merged[:10]:

            print(
                "-",
                item.get("source"),
                "| chunk:",
                item.get("chunk"),
                "| fusion:",
                round(
                    self._safe_float(
                        item.get(
                            "fusion_score",
                            0.0
                        )
                    ),
                    5
                ),
                "| queries:",
                item.get(
                    "matched_queries",
                    []
                ),
                "| methods:",
                item.get(
                    "retrieval_methods",
                    []
                )
            )

        if not merged:

            print()
            print("No fused search results were found.")

            return []

        # -----------------------------------------------------
        # STEP 7
        # -----------------------------------------------------

        print()
        print("=" * 70)
        print("STEP 7 : CROSS-ENCODER RERANKING")
        print("=" * 70)

        rerank_pool_size = min(
            len(merged),
            max(
                top_k * 8,
                40
            )
        )

        rerank_candidates = merged[
            :rerank_pool_size
        ]

        # Rerank the complete candidate pool.
        #
        # Do not request only top_k here, because combined
        # ranking must be calculated across all candidates.

        reranked_pool = self.reranker.rerank(
            query=query,
            results=rerank_candidates,
            top_k=len(rerank_candidates)
        )

        print(
            "Reranking pool:",
            len(rerank_candidates)
        )

        print(
            "Cross-encoder results:",
            len(reranked_pool)
        )

        # -----------------------------------------------------
        # STEP 8
        # -----------------------------------------------------

        print()
        print("=" * 70)
        print("STEP 8 : COMBINED SCORE RANKING")
        print("=" * 70)

        combined_results = self._combine_scores(
            results=reranked_pool,
            fusion_weight=self.fusion_weight,
            rerank_weight=self.rerank_weight
        )

        reranked = combined_results[
            :top_k
        ]

        print(
            "Fusion weight:",
            self.fusion_weight
        )

        print(
            "Reranker weight:",
            self.rerank_weight
        )

        print(
            "Final reranked results:",
            len(reranked)
        )

        print()
        print("Top combined-score candidates:")

        for item in reranked:

            print(
                "-",
                item.get("source"),
                "| chunk:",
                item.get("chunk"),
                "| fusion:",
                round(
                    self._safe_float(
                        item.get(
                            "fusion_score",
                            0.0
                        )
                    ),
                    5
                ),
                "| fusion normalized:",
                round(
                    self._safe_float(
                        item.get(
                            "fusion_score_normalized",
                            0.0
                        )
                    ),
                    5
                ),
                "| rerank:",
                round(
                    self._safe_float(
                        item.get(
                            "rerank_score",
                            0.0
                        )
                    ),
                    5
                ),
                "| rerank normalized:",
                round(
                    self._safe_float(
                        item.get(
                            "rerank_score_normalized",
                            0.0
                        )
                    ),
                    5
                ),
                "| combined:",
                round(
                    self._safe_float(
                        item.get(
                            "combined_score",
                            0.0
                        )
                    ),
                    5
                ),
                "| queries:",
                item.get(
                    "matched_queries",
                    []
                )
            )

        # -----------------------------------------------------
        # STEP 9
        # -----------------------------------------------------

        print()
        print("=" * 70)
        print("STEP 9 : CONTEXT EXPANSION")
        print("=" * 70)

        expanded_results = self.context.expand(
            reranked
        )

        print(
            "Expanded context results:",
            len(expanded_results)
        )

        # -----------------------------------------------------
        # STEP 10
        # -----------------------------------------------------

        print()
        print("=" * 70)
        print("STEP 10 : CONTEXT COMPRESSION")
        print("=" * 70)

        compressed = self.compressor.compress(
            expanded_results
        )

        print(
            "Compressed results:",
            len(compressed)
        )

        # -----------------------------------------------------
        # STEP 11
        # -----------------------------------------------------

        print()
        print("=" * 70)
        print("STEP 11 : CITATION BUILDER")
        print("=" * 70)

        final = self.citations.build_all(
            compressed
        )

        print(
            "Final results:",
            len(final)
        )

        return final

    # ---------------------------------------------------------

    def _build_weighted_queries(
        self,
        original_query,
        expansion,
        generated_queries
    ):
        """
        Build a deduplicated list of weighted search queries.

        Priority:

        original question             1.00
        exact concept                 1.00
        alias                         0.95
        concept + Scripture           0.90
        concept + related concept     0.80
        generated query               0.75
        Scripture alone               0.65
        related concept alone         0.50
        """

        weighted = []

        seen = {}

        def add(
            value,
            weight,
            query_type
        ):

            if value is None:
                return

            normalized = str(
                value
            ).strip()

            if not normalized:
                return

            key = normalized.casefold()

            existing_index = seen.get(
                key
            )

            if existing_index is not None:

                existing = weighted[
                    existing_index
                ]

                if weight > existing["weight"]:

                    existing["weight"] = float(
                        weight
                    )

                    existing["query_type"] = (
                        query_type
                    )

                return

            seen[key] = len(
                weighted
            )

            weighted.append({
                "query": normalized,
                "weight": float(weight),
                "query_type": query_type
            })

        # Original question

        add(
            original_query,
            1.00,
            "original"
        )

        concept_name = expansion.get(
            "concept"
        )

        concept = None

        if concept_name:

            concept = self.expander.repository.get(
                concept_name
            )

        if concept is not None:

            # Exact concept name

            add(
                concept.name,
                1.00,
                "concept"
            )

            # Concept aliases

            for alias in concept.aliases:

                add(
                    alias,
                    0.95,
                    "alias"
                )

            # Scripture references and concept combinations

            for scripture in concept.scriptures:

                add(
                    scripture,
                    0.65,
                    "scripture"
                )

                add(
                    f"{concept.name} {scripture}",
                    0.90,
                    "concept_scripture"
                )

            # Related concepts and concept combinations

            for related in concept.related:

                add(
                    related,
                    0.50,
                    "related"
                )

                add(
                    f"{concept.name} {related}",
                    0.80,
                    "concept_related"
                )

        # Preserve additional queries generated by the
        # multi-query generator.

        for generated_query in generated_queries:

            add(
                generated_query,
                0.75,
                "generated"
            )

        return weighted

    # ---------------------------------------------------------

    @classmethod
    def _combine_scores(
        cls,
        results,
        fusion_weight=0.70,
        rerank_weight=0.30
    ):
        """
        Normalize fusion and cross-encoder scores and calculate
        a final combined score.

        Fusion remains the primary signal because it contains
        evidence collected across:

        - the original question
        - concept names
        - aliases
        - Scripture references
        - related concepts
        - semantic retrieval
        - BM25 retrieval

        The cross-encoder refines rather than replaces fusion.
        """

        if not results:

            return []

        fusion_weight = cls._safe_float(
            fusion_weight
        )

        rerank_weight = cls._safe_float(
            rerank_weight
        )

        total_weight = (
            fusion_weight
            +
            rerank_weight
        )

        if total_weight <= 0.0:

            fusion_weight = 0.70

            rerank_weight = 0.30

            total_weight = 1.0

        fusion_weight = (
            fusion_weight
            /
            total_weight
        )

        rerank_weight = (
            rerank_weight
            /
            total_weight
        )

        fusion_values = [
            cls._safe_float(
                item.get(
                    "fusion_score",
                    0.0
                )
            )
            for item in results
        ]

        rerank_values = [
            cls._safe_float(
                item.get(
                    "rerank_score",
                    0.0
                )
            )
            for item in results
        ]

        fusion_min = min(
            fusion_values
        )

        fusion_max = max(
            fusion_values
        )

        rerank_min = min(
            rerank_values
        )

        rerank_max = max(
            rerank_values
        )

        fusion_range = (
            fusion_max
            -
            fusion_min
        )

        rerank_range = (
            rerank_max
            -
            rerank_min
        )

        for item in results:

            fusion_score = cls._safe_float(
                item.get(
                    "fusion_score",
                    0.0
                )
            )

            rerank_score = cls._safe_float(
                item.get(
                    "rerank_score",
                    0.0
                )
            )

            fusion_normalized = cls._normalize_score(
                value=fusion_score,
                minimum=fusion_min,
                score_range=fusion_range
            )

            rerank_normalized = cls._normalize_score(
                value=rerank_score,
                minimum=rerank_min,
                score_range=rerank_range
            )

            combined_score = (
                fusion_normalized
                *
                fusion_weight
                +
                rerank_normalized
                *
                rerank_weight
            )

            item[
                "fusion_score_normalized"
            ] = fusion_normalized

            item[
                "rerank_score_normalized"
            ] = rerank_normalized

            item[
                "combined_score"
            ] = combined_score

        results.sort(
            key=lambda item: (
                cls._safe_float(
                    item.get(
                        "combined_score",
                        0.0
                    )
                ),
                cls._safe_float(
                    item.get(
                        "fusion_score",
                        0.0
                    )
                ),
                cls._safe_float(
                    item.get(
                        "rerank_score",
                        0.0
                    )
                )
            ),
            reverse=True
        )

        return results

    # ---------------------------------------------------------

    @staticmethod
    def _normalize_score(
        value,
        minimum,
        score_range
    ):
        """
        Min-max normalize a score to the range 0.0 to 1.0.
        """

        value = RetrievalPipeline._safe_float(
            value
        )

        minimum = RetrievalPipeline._safe_float(
            minimum
        )

        score_range = RetrievalPipeline._safe_float(
            score_range
        )

        if abs(score_range) < 1e-12:

            # All candidates have the same score.
            # Treat them as equally strong.

            return 1.0

        normalized = (
            value
            -
            minimum
        ) / score_range

        return max(
            0.0,
            min(
                1.0,
                normalized
            )
        )

    # ---------------------------------------------------------

    @staticmethod
    def _safe_float(
        value,
        default=0.0
    ):
        """
        Convert a value to float without breaking the pipeline.
        """

        try:

            return float(
                value
            )

        except (
            TypeError,
            ValueError
        ):

            return float(
                default
            )

    # ---------------------------------------------------------

    @staticmethod
    def _validate_query(
        query
    ):
        """
        Validate and normalize a search query.
        """

        if not isinstance(
            query,
            str
        ):

            raise ValueError(
                "Query must be a string."
            )

        query = query.strip()

        if not query:

            raise ValueError(
                "Query cannot be empty."
            )

        return query

    # ---------------------------------------------------------

    @staticmethod
    def _validate_top_k(
        top_k
    ):
        """
        Validate and normalize the requested result count.
        """

        try:

            top_k = int(
                top_k
            )

        except (
            TypeError,
            ValueError
        ):

            raise ValueError(
                "top_k must be an integer."
            )

        if top_k < 1:

            raise ValueError(
                "top_k must be at least 1."
            )

        return top_k

    # ---------------------------------------------------------

    @staticmethod
    def _annotate_results(
        results,
        search_query,
        retrieval_method,
        query_weight,
        query_type
    ):
        """
        Attach retrieval diagnostics to every search result.
        """

        if not results:
            return

        for result in results:

            if not isinstance(
                result,
                dict
            ):

                continue

            result["matched_query"] = (
                search_query
            )

            result["retrieval_method"] = (
                retrieval_method
            )

            result["query_weight"] = float(
                query_weight
            )

            result["query_type"] = (
                query_type
            )

            # Preserve the raw search score for diagnostics.

            result["retrieval_score"] = (
                RetrievalPipeline._safe_float(
                    result.get(
                        "score",
                        0.0
                    )
                )
            )