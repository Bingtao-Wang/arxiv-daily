"""Stdlib-only signed Worker callback, usable before installing parser/model dependencies."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


PAPER_ID = re.compile(r"^(\d{4}\.\d{4,5})(?:v[1-9]\d*)?$")


def callback(job_id: str, payload: dict, *, base_url: str | None = None,
             secret: str | None = None, run_token: str | None = None,
             arxiv_id: str | None = None) -> None:
    api_base = (base_url or os.environ.get("AI_READING_API_BASE", "")).rstrip("/")
    callback_secret = secret or os.environ.get("AI_READING_CALLBACK_SECRET", "")
    token = run_token or os.environ.get("AI_READING_RUN_TOKEN", "")
    if not api_base.startswith("https://") or len(callback_secret) < 32:
        raise RuntimeError("AI reading callback URL or secret is not configured")
    if not re.fullmatch(r"[A-Za-z0-9_-]{40,128}", token):
        raise RuntimeError("Worker run token is missing or malformed")
    raw_paper_id = arxiv_id or os.environ.get("AI_READING_ARXIV_ID", "")
    match = PAPER_ID.fullmatch(raw_paper_id)
    if not match:
        raise RuntimeError("Worker paper ID is missing or malformed")
    body = json.dumps({**payload, "jobId": job_id, "arxivId": match.group(1), "runToken": token},
                      ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    timestamp = str(int(time.time() * 1000))
    nonce = secrets.token_urlsafe(24)
    signature = hmac.new(callback_secret.encode("utf-8"),
                         timestamp.encode("ascii") + b"." + nonce.encode("ascii") + b"." + body,
                         hashlib.sha256).hexdigest()
    request = Request(
        f"{api_base}/api/internal/jobs/{job_id}",
        data=body,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "X-Callback-Timestamp": timestamp,
            "X-Callback-Nonce": nonce,
            "X-Callback-Signature": "sha256=" + signature,
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            if not 200 <= response.status < 300:
                raise RuntimeError(f"Callback returned HTTP {response.status}")
    except HTTPError as exc:
        message = exc.read(1000).decode("utf-8", "replace")
        raise RuntimeError(f"Callback rejected the update: HTTP {exc.code}: {message}") from exc
    except URLError as exc:
        raise RuntimeError(f"Callback could not reach the Worker: {exc.reason}") from exc
