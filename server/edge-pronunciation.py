import asyncio
import json
import sys

import edge_tts

sys.stdin.reconfigure(encoding="utf-8")


async def main():
    request = json.loads(sys.stdin.read())
    communicator = edge_tts.Communicate(
        request["text"],
        request["voice"],
        rate=request.get("rate", "+0%"),
    )
    async for chunk in communicator.stream():
        if chunk["type"] == "audio":
            sys.stdout.buffer.write(chunk["data"])
            sys.stdout.buffer.flush()


asyncio.run(main())
