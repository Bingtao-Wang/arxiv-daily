"""Validate Worker ownership before installing large PDF dependencies."""

from __future__ import annotations

import os
import re
from .callback import callback, PAPER_ID


def main() -> int:
    job_id = os.getenv("AI_READING_JOB_ID", "")
    paper_id = os.getenv("AI_READING_ARXIV_ID", "")
    run_token = os.getenv("AI_READING_RUN_TOKEN", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", job_id) or not PAPER_ID.fullmatch(paper_id) \
            or not re.fullmatch(r"[A-Za-z0-9_-]{40,128}", run_token):
        raise RuntimeError("Worker dispatch inputs are missing or malformed")
    callback(job_id, {"status": "running", "stage": "已验证任务授权，正在准备解析环境"})
    if not os.getenv("OPENAI_API_KEY"):
        callback(job_id, {"status": "failed", "stage": "论文解读失败", "error": "OPENAI_API_KEY is not configured"})
        raise RuntimeError("OPENAI_API_KEY is not configured")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
