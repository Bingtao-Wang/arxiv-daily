"""GitHub Actions entry point. All callbacks are authenticated by HMAC."""

from __future__ import annotations

import argparse
import os
import re
import sys

from .callback import callback
from .generate import BudgetLedger, generate_report, ledger_from_env
from .source import fetch_paper, split_arxiv_id


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--arxiv-id", required=True)
    parser.add_argument("--version", default="")
    args = parser.parse_args()
    if not args.job_id or len(args.job_id) > 128 or not all(c.isalnum() or c in "-_" for c in args.job_id):
        parser.error("Invalid job ID")
    split_arxiv_id(args.arxiv_id)
    if args.version:
        split_arxiv_id(args.version)
    ledger: BudgetLedger = ledger_from_env()
    try:
        if not re.fullmatch(r"[A-Za-z0-9_-]{40,128}", os.getenv("AI_READING_RUN_TOKEN", "")):
            raise RuntimeError("Worker run token is missing or malformed")
        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY is not configured")
        callback(args.job_id, {"status": "running", "stage": "正在获取锁定版本的论文全文"})
        source = fetch_paper(args.arxiv_id, args.version or None)
        print(f"Locked {source.version}: {source.format}, {len(source.passages)} passages, "
              f"{len(source.figures)} matched figure candidates", flush=True)
        callback(args.job_id, {"status": "running", "stage": "正在逐段提取证据并生成中文解读", "sourceVersion": source.version})
        from openai import OpenAI
        client = OpenAI(timeout=120, max_retries=0)
        report, ledger = generate_report(source, client, os.getenv("AI_READING_MODEL", "gpt-6.1-sol"), ledger)
        callback(args.job_id, {
            "status": "succeeded", "stage": "已发布 AI 解读", "sourceVersion": source.version,
            "report": report, "usage": ledger.as_json(),
        })
        print(f"Published {source.version}; usage={ledger.as_json()}", flush=True)
        return 0
    except Exception as exc:
        print(f"AI reading failed: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
        try:
            callback(args.job_id, {
                "status": "failed", "stage": "论文解读失败", "error": str(exc)[:500],
                "usage": ledger.as_json(),
            })
        except Exception as callback_exc:
            print(f"Failure callback also failed: {callback_exc}", file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
