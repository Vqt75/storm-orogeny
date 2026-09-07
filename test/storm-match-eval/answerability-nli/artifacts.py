"""Strict validation for pinned NLI artifacts stored outside the repository."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent


def load_specs() -> dict[str, dict[str, Any]]:
    payload = json.loads((HERE / "model-specs.json").read_text(encoding="utf-8"))
    return {item["key"]: item for item in payload["models"]}


MODEL_SPECS = load_specs()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def content_fingerprint(root: Path, files: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(files, key=lambda item: item.relative_to(root).as_posix()):
        relative = path.relative_to(root).as_posix()
        digest.update(relative.encode())
        digest.update(b"\0")
        with path.open("rb") as source:
            while chunk := source.read(8 * 1024 * 1024):
                digest.update(chunk)
    return digest.hexdigest()


def validate_artifact(model_key: str, model_path: Path) -> dict[str, Any]:
    if model_key not in MODEL_SPECS:
        raise ValueError(f"Unknown NLI model: {model_key}")
    if not model_path.is_absolute() or not model_path.is_dir():
        raise ValueError(f"NLI path must be an existing absolute directory: {model_path}")
    spec = MODEL_SPECS[model_key]
    files = [model_path / name for name in spec["files"]]
    missing = [path.name for path in files if not path.is_file()]
    if missing:
        raise ValueError(f"{model_key}: missing files: {', '.join(missing)}")
    config = json.loads((model_path / "config.json").read_text(encoding="utf-8"))
    if config.get("architectures") != [spec["architecture"]] or config.get("model_type") != spec["modelType"]:
        raise ValueError(f"{model_key}: architecture contract mismatch")
    actual_labels = {str(key): value.lower() for key, value in config.get("id2label", {}).items()}
    expected_labels = {str(value): key for key, value in spec["labelIds"].items()}
    if actual_labels != expected_labels:
        raise ValueError(f"{model_key}: NLI label mapping mismatch: {actual_labels!r}")
    weight = model_path / "model.safetensors"
    artifact_bytes = sum(path.stat().st_size for path in files)
    if weight.stat().st_size != spec["weightBytes"] or artifact_bytes != spec["artifactBytes"]:
        raise ValueError(f"{model_key}: pinned artifact size mismatch")
    fingerprint = content_fingerprint(model_path, files)
    checksum = file_sha256(weight)
    if fingerprint != spec["artifactFingerprint"] or checksum != spec["weightSha256"]:
        raise ValueError(f"{model_key}: pinned checksum mismatch")
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
        "artifactBytes": artifact_bytes,
        "artifactFingerprint": fingerprint,
        "weightSha256": checksum,
        "files": spec["files"],
    }
