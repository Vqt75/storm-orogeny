"""Benchmark-only sentence-transformer adapters with strict local contracts."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

# These flags are set before importing sentence-transformers/transformers. A
# local path is also mandatory, so a missing artifact fails instead of falling
# back to a Hub model id.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_DATASETS_OFFLINE", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

HERE = Path(__file__).resolve().parent


def load_model_specs() -> dict[str, dict[str, Any]]:
    payload = json.loads((HERE / "model-specs.json").read_text(encoding="utf-8"))
    return {item["key"]: item for item in payload["models"]}


MODEL_SPECS = load_model_specs()


def _read_json(path: Path) -> Any:
    if not path.is_file():
        raise ValueError(f"Required local model file is missing: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def validate_local_artifact(model_key: str, model_path: Path) -> dict[str, Any]:
    """Validate the checked-in model contract before loading any weights."""
    if model_key not in MODEL_SPECS:
        raise ValueError(f"Unknown model key: {model_key}")
    if not model_path.is_absolute():
        raise ValueError("Model path must be absolute")
    if not model_path.is_dir():
        raise ValueError(f"Local model directory does not exist: {model_path}")

    spec = MODEL_SPECS[model_key]
    modules = _read_json(model_path / "modules.json")
    module_types = [item["type"] for item in modules]
    if module_types != spec["moduleTypes"]:
        raise ValueError(
            f"{model_key}: module pipeline mismatch: {module_types!r} != {spec['moduleTypes']!r}"
        )

    sentence_config = _read_json(model_path / "sentence_bert_config.json")
    if sentence_config.get("max_seq_length") != spec["maxSequenceLength"]:
        raise ValueError(f"{model_key}: max sequence length mismatch")
    if sentence_config.get("do_lower_case") is not spec["doLowerCase"]:
        raise ValueError(f"{model_key}: casing contract mismatch")

    pooling = _read_json(model_path / "1_Pooling" / "config.json")
    expected_pooling = {
        "pooling_mode_cls_token": False,
        "pooling_mode_mean_tokens": True,
        "pooling_mode_max_tokens": False,
        "pooling_mode_mean_sqrt_len_tokens": False,
    }
    for key, expected in expected_pooling.items():
        if pooling.get(key) is not expected:
            raise ValueError(f"{model_key}: unsupported pooling setting {key}={pooling.get(key)!r}")
    if pooling.get("word_embedding_dimension") != spec["poolingInputDimension"]:
        raise ValueError(f"{model_key}: pooling input dimension mismatch")

    if model_key == "distiluse-cased-v2":
        dense = _read_json(model_path / "2_Dense" / "config.json")
        expected_dense = {
            "in_features": 768,
            "out_features": 512,
            "activation_function": "torch.nn.modules.activation.Tanh",
        }
        for key, expected in expected_dense.items():
            if dense.get(key) != expected:
                raise ValueError(f"{model_key}: dense projection mismatch for {key}")

    weight_files = _select_weight_files(model_path)
    if not weight_files:
        raise ValueError(f"No local PyTorch/Safetensors weights found below {model_path}")

    return {
        "moduleTypes": module_types,
        "weightFiles": [str(path.relative_to(model_path)).replace("\\", "/") for path in weight_files],
        "weightsBytes": sum(path.stat().st_size for path in weight_files),
        "artifactBytes": sum(path.stat().st_size for path in model_path.rglob("*") if path.is_file()),
        "artifactDescriptorFingerprint": _artifact_descriptor_fingerprint(model_path, weight_files),
    }


def _select_weight_files(model_path: Path) -> list[Path]:
    selected: list[Path] = []
    for directory, dirs, files in os.walk(model_path):
        dirs[:] = [name for name in dirs if name not in {"onnx", "openvino", ".git"}]
        base = Path(directory)
        safe = sorted(base / name for name in files if name.endswith(".safetensors"))
        if safe:
            selected.extend(safe)
            continue
        selected.extend(
            sorted(
                base / name
                for name in files
                if name in {"pytorch_model.bin", "model.bin"}
                or (name.startswith("pytorch_model-") and name.endswith(".bin"))
            )
        )
    return selected


def _artifact_descriptor_fingerprint(model_path: Path, weight_files: list[Path]) -> str:
    digest = hashlib.sha256()
    for relative in [
        "modules.json",
        "sentence_bert_config.json",
        "1_Pooling/config.json",
        "2_Dense/config.json",
        "config.json",
    ]:
        path = model_path / relative
        if path.is_file():
            digest.update(relative.encode())
            digest.update(path.read_bytes())
    for path in weight_files:
        digest.update(str(path.relative_to(model_path)).replace("\\", "/").encode())
        digest.update(str(path.stat().st_size).encode())
    return digest.hexdigest()


def compute_artifact_fingerprint(model_path: Path, selected_weight_files: list[str]) -> str:
    """Hash effective weights plus local configs/tokenizer after timed inference."""
    selected = {item.replace("\\", "/") for item in selected_weight_files}
    digest = hashlib.sha256()
    for path in sorted(model_path.rglob("*")):
        if not path.is_file() or any(part in {"onnx", "openvino", ".git"} for part in path.parts):
            continue
        relative = str(path.relative_to(model_path)).replace("\\", "/")
        is_weight = path.suffix in {".bin", ".safetensors", ".pt", ".pth"}
        if is_weight and relative not in selected:
            continue
        digest.update(relative.encode())
        with path.open("rb") as source:
            while chunk := source.read(8 * 1024 * 1024):
                digest.update(chunk)
    return digest.hexdigest()


class SentenceTransformerBenchmarkAdapter:
    """Not a product SemanticProvider: a strict benchmark-only adapter."""

    def __init__(self, model_key: str, model_path: Path, device: str, batch_size: int):
        self.spec = MODEL_SPECS[model_key]
        self.model_key = model_key
        self.model_path = model_path.resolve(strict=True)
        self.device = device
        self.batch_size = batch_size
        self.artifact = validate_local_artifact(model_key, self.model_path)
        self.model = None

    def load(self) -> None:
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(
            str(self.model_path),
            device=self.device,
            local_files_only=True,
            trust_remote_code=False,
        )
        self.model.eval()
        if self.model.max_seq_length != self.spec["maxSequenceLength"]:
            raise ValueError(f"{self.model_key}: loaded max sequence length mismatch")
        if self.model.get_sentence_embedding_dimension() != self.spec["dimension"]:
            raise ValueError(f"{self.model_key}: loaded embedding dimension mismatch")
        loaded_types = [type(module).__name__ for module in self.model._modules.values()]
        expected_types = [item.rsplit(".", 1)[-1] for item in self.spec["moduleTypes"]]
        if loaded_types != expected_types:
            raise ValueError(f"{self.model_key}: loaded module pipeline mismatch: {loaded_types!r}")

    def encode_queries(self, texts: list[str], *, batch_size: int | None = None):
        return self._encode([self.spec["queryPrefix"] + text for text in texts], batch_size=batch_size)

    def encode_passages(self, texts: list[str], *, batch_size: int | None = None):
        return self._encode([self.spec["passagePrefix"] + text for text in texts], batch_size=batch_size)

    def _encode(self, texts: list[str], *, batch_size: int | None = None):
        if self.model is None:
            raise RuntimeError("Adapter must be loaded before encoding")
        vectors = self.model.encode(
            texts,
            batch_size=batch_size or self.batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        if vectors.ndim != 2 or vectors.shape[1] != self.spec["dimension"]:
            raise ValueError(f"{self.model_key}: unexpected embedding shape {vectors.shape!r}")
        return vectors
