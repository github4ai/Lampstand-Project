import os
import tempfile
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel

app = FastAPI(title="AIOS Local Whisper", version="1.0.0")

MODEL_NAME = os.getenv("WHISPER_LOCAL_MODEL", "small")
MAX_AUDIO_BYTES = int(os.getenv("AIOS_MAX_AUDIO_MB", "25")) * 1024 * 1024
SUPPORTED_LANGUAGES = {"en", "zh", "ta", "hi", "mr", "te", "ml"}

_model: WhisperModel | None = None
_model_lock = Lock()


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                _model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
    return _model


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "model": MODEL_NAME, "loaded": _model is not None}


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form(default="whisper-1"),
    language: str = Form(default="en"),
) -> dict[str, object]:
    del model  # Compatibility field; the local model is selected by WHISPER_LOCAL_MODEL.
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Unsupported transcription language.")

    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    content = await file.read(MAX_AUDIO_BYTES + 1)
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file is too large.")

    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name
        segments, info = get_model().transcribe(
            temp_path,
            language=language,
            beam_size=5,
            vad_filter=True,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
        return {"text": text, "language": language, "duration": info.duration}
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
