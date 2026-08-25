import json
from pathlib import Path


class DocumentStore:
    """
    Loads manifests and chunk files once.

    Caches everything in memory for
    extremely fast retrieval.
    """

    def __init__(self, index_root="Index"):

        self.index_root = Path(index_root)

        # Cached manifests
        self.manifests = {}

        # Last modification time for each cached manifest.
        # Indexing may finish while the API remains running.
        self.manifest_mtimes = {}

        # Cached chunk lists
        self.chunk_lists = {}

        # Cached dictionaries
        self.chunk_maps = {}

    # ---------------------------------------------------------
    # Manifest
    # ---------------------------------------------------------

    def load_manifest(self, category):
        path = (

            self.index_root /

            category /

            "Metadata" /

            "chunk_manifest.json"

        )

        modified_at = path.stat().st_mtime_ns

        if (
            category in self.manifests
            and self.manifest_mtimes.get(category) == modified_at
        ):
            return self.manifests[category]

        with open(

            path,

            "r",

            encoding="utf-8"

        ) as f:

            manifest = json.load(f)

        self.manifests[category] = manifest

        self.manifest_mtimes[category] = modified_at

        return manifest

    # ---------------------------------------------------------
    # Chunk List
    # ---------------------------------------------------------

    def load_chunk_file(

        self,

        category,

        chunk_file

    ):

        key = (

            category,

            chunk_file

        )

        if key in self.chunk_lists:
            return self.chunk_lists[key]

        path = (

            self.index_root /

            category /

            "Chunks" /

            chunk_file

        )

        with open(

            path,

            "r",

            encoding="utf-8"

        ) as f:

            chunks = json.load(f)

        self.chunk_lists[key] = chunks

        return chunks

    # ---------------------------------------------------------
    # Chunk Map
    # ---------------------------------------------------------

    def load_chunk_map(

        self,

        category,

        chunk_file

    ):

        key = (

            category,

            chunk_file

        )

        if key in self.chunk_maps:
            return self.chunk_maps[key]

        chunks = self.load_chunk_file(

            category,

            chunk_file

        )

        mapping = {

            chunk["id"]: chunk

            for chunk in chunks

        }

        self.chunk_maps[key] = mapping

        return mapping

    # ---------------------------------------------------------
    # Get Chunk
    # ---------------------------------------------------------

    def get_chunk(

        self,

        category,

        chunk_file,

        chunk_id

    ):

        mapping = self.load_chunk_map(

            category,

            chunk_file

        )

        return mapping.get(chunk_id)

    # ---------------------------------------------------------
    # Neighbor Chunks
    # ---------------------------------------------------------

    def get_neighbor_chunks(

        self,

        category,

        chunk_file,

        chunk_id,

        before=1,

        after=1

    ):

        mapping = self.load_chunk_map(

            category,

            chunk_file

        )

        results = []

        for cid in range(

            chunk_id - before,

            chunk_id + after + 1

        ):

            if cid in mapping:

                results.append(

                    mapping[cid]

                )

        return results

    # ---------------------------------------------------------
    # Clear Cache
    # ---------------------------------------------------------

    def clear(self):

        self.manifests.clear()

        self.manifest_mtimes.clear()

        self.chunk_lists.clear()

        self.chunk_maps.clear()

    # ---------------------------------------------------------
    # Cache Statistics
    # ---------------------------------------------------------

    def stats(self):

        return {

            "manifests": len(self.manifests),

            "chunk_lists": len(self.chunk_lists),

            "chunk_maps": len(self.chunk_maps)

        }
