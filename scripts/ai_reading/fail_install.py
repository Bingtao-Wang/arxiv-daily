"""Mark dependency installation failure without importing the failed dependencies."""

from __future__ import annotations

import os
from .callback import callback


if __name__ == "__main__":
    callback(os.environ["AI_READING_JOB_ID"], {
        "status": "failed",
        "stage": "论文解读失败",
        "error": "全文解析依赖安装失败，请检查 GitHub Actions 日志后重试",
    })
