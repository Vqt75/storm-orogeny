"""Strict validation for external, pinned verifier artifacts."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent


def load_specs() -> dict[str, dict[str, Any]]:
    payload = json.loads((HERE / "verifier-model-specs.json").read_text(encoding="utf-8"))
    return {item["key"]: item for item in payload["models"]}


MODEL_SPECS = load_specs()


def _content_fingerprint(root: Path, files: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(files, key=lambda item: item.relative_to(root).as_posix()):
        relative = path.relative_to(root).as_posix()
        digest.update(relative.encode())
        digest.update(b"\0")
        with path.open("rb") as source:
            while chunk := source.read(8 * 1024 * 1024):
                digest.update(chunk)
    return digest.hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def validate_artifact(model_key: str, model_path: Path) -> dict[str, Any]:
    if model_key not in MODEL_SPECS:
        raise ValueError(f"Unknown verifier model: {model_key}")
    if not model_path.is_absolute() or not model_path.is_dir():
        raise ValueError(f"Verifier path must be an existing absolute directory: {model_path}")
    spec = MODEL_SPECS[model_key]
    required = [
        "README.md", "config.json", "model.safetensors", "sentencepiece.bpe.model",
        "special_tokens_map.json", "tokenizer.json", "tokenizer_config.json",
    ]
    files = [model_path / name for name in required]
    missing = [path.name for path in files if not path.is_file()]
    if missing:
        raise ValueError(f"{model_key}: missing files: {', '.join(missing)}")
    forbidden = [path for path in model_path.rglob("*") if path.is_file() and any(
        part.lower() in {"onnx", "openvino"} for part in path.parts
    )]
    if forbidden:
        raise ValueError(f"{model_key}: unexpected alternate weights: {forbidden[0]}")
    config = json.loads((model_path / "config.json").read_text(encoding="utf-8"))
    if config.get("architectures") != [spec["architecture"]]:
        raise ValueError(f"{model_key}: architecture mismatch")
    if config.get("model_type") != spec["modelType"]:
        raise ValueError(f"{model_key}: model type mismatch")
    weight = model_path / "model.safetensors"
    if weight.stat().st_size != spec["weightBytes"]:
        raise ValueError(f"{model_key}: pinned weight size mismatch")
    revision_metadata = model_path / ".cache" / "huggingface" / "trees" / f"{spec['revision']}.json"
    if not revision_metadata.is_file():
        raise ValueError(f"{model_key}: pinned revision metadata missing")
    return {
        "key": model_key,
        "modelId": spec["modelId"],
        "revision": spec["revision"],
        "license": spec["license"],
        "architecture": spec["architecture"],
        "parameters": spec["parameters"],
        "benchmarkMaxLength": spec["benchmarkMaxLength"],
        "files": [path.relative_to(model_path).as_posix() for path in files],
        "artifactBytes": sum(path.stat().st_size for path in files),
        "artifactFingerprint": _content_fingerprint(model_path, files),
        "weightSha256": file_sha256(weight),
    }
