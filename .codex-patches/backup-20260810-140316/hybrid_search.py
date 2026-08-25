from AIOS.Search.bm25_index import BM25Index


class HybridSearch:

    """
    Combines semantic FAISS search
    with lexical BM25 search.
    """

    def __init__(self, search_engine):

        self.engine = search_engine

        self.bm25_indexes = {}

    # ---------------------------------------------------------

    def get_bm25(self, category):

        if category in self.bm25_indexes:
            return self.bm25_indexes[category]

        manifest = self.engine.store.load_manifest(
            category
        )

        bm25 = BM25Index()

        bm25.build(
            manifest=manifest,
            store=self.engine.store,
            category=category
        )

        self.bm25_indexes[category] = bm25

        return bm25

    # ---------------------------------------------------------

    def search(
        self,
        query,
        category="Ministry",
        top_k=10
    ):

        bm25 = self.get_bm25(category)

        return bm25.search(
            query=query,
            top_k=top_k
        )