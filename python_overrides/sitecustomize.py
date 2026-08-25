"""AIOS Studio runtime corrections loaded automatically by local Python."""

try:
    from AIOS.Search.embedding_search import EmbeddingSearch

    def search_per_document(self, query_vector, category="Ministry", top_k=30):
        results = []
        for database in self.loader.load_all(category):
            chunk_file = f"{database['name']}_chunks.json"
            try:
                chunks = self.engine.store.load_chunk_file(category, chunk_file)
            except FileNotFoundError:
                continue
            scores, ids = database["db"].search(query_vector, top_k)
            for score, vector_id in zip(scores[0], ids[0]):
                if vector_id < 0 or vector_id >= len(chunks):
                    continue
                chunk = chunks[vector_id]
                results.append({
                    "score": float(score),
                    "source": chunk.get("source"),
                    "category": category,
                    "page": chunk.get("page"),
                    "chunk": chunk.get("chunk"),
                    "chunk_file": chunk_file,
                    "text": chunk.get("text", ""),
                })
        return results

    EmbeddingSearch.search = search_per_document
except Exception as error:
    print(f"AIOS Studio search correction was not loaded: {error}")
