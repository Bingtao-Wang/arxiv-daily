# AI 全文解读的离线验收

`scripts/ai_reading/evaluate.py` 只解析论文和核对已有报告，不调用 OpenAI。固定样例是 [VOMMI v1 HTML](https://arxiv.org/html/2610.08220v1) 与 [UMI v1 PDF](https://arxiv.org/pdf/2402.10329v1)。UMI 的样例**强制走 PDF/Docling 路径**，用于验证 HTML 不可用时的后备行为；这不表示 UMI 本身没有 arXiv HTML。

```powershell
cd E:\GitHub\arxiv-daily
# 首次准备 Python 环境；Docling 的体积和模型权重较大
python -m venv work/ai-reading-venv
& 'work\ai-reading-venv\Scripts\python.exe' -m pip install -r scripts/ai_reading/requirements.txt
& 'work\ai-reading-venv\Scripts\python.exe' -m scripts.ai_reading.evaluate --fetch-missing --output work/ai-reading-audit/result.json
& 'work\ai-reading-venv\Scripts\python.exe' -m unittest scripts.ai_reading.test_evaluate -v
```

可选的真实 UMI PDF 表格回归需先准备上述缓存与 Docling：`$env:AI_READING_REAL_PDF_TEST='1'; & 'work\ai-reading-venv\Scripts\python.exe' -m unittest scripts.ai_reading.test_pipeline.SourceTests.test_cached_umi_pdf_table_a1_real_docling -v`。常规 CI 不下载这份约 7.6 MB 的 PDF 和 Docling 权重，因此此项默认跳过。

首次运行会从精确版本的 arXiv 地址下载缺失文件到被 Git 忽略的 `work/ai-reading-audit/`；Docling 首次运行也可能下载模型权重。两者缓存齐备后，不加 `--fetch-missing` 即可离线复跑。默认 Anaconda `python` 如果没有安装 Docling，PDF 样例会失败；本次实测使用的是已有的 `work/docling-audit/Scripts/python.exe` 环境，并复用了 `work/docling-audit/umi-v1.pdf`。JSON 保存输入文件的 SHA-256；本地缓存本身不能证明原始下载来源。脚本逐项检查锁定版本、正文段落与章节、唯一定位符、链接、同版本图号/图注/官方图片地址；PDF 路径不得产生猜测的论文原图地址。

2026-10-09 至 10 的真实来源验收结果如下。VOMMI HTML 得到 102 个定位单元（含 5 张表格、26 条公式）、14 类章节/表格/公式定位、6 张同版本原图候选；UMI PDF 得到 228 个带页码定位单元（含 3 张表格）、32 类章节/表格定位、0 张原图候选，附录 Table A1 的训练超参数已纳入。两例的来源检查均通过。定位单元和章节数量受解析器版本影响，也不宜用两种格式的数量直接比较论文质量。源文件和完整 JSON 留在本机 `work/ai-reading-audit/`，不进入公开仓库。

如已获得一次真实生成的报告和回调用量，可加 `--vommi-report path.json --vommi-usage path.json` 或对应的 `--umi-report/--umi-usage`。报告审计会逐条检查原文摘录是否出现在锁定版本的定位段落、来源 URL 是否一致、原图是否属于解析器认可的候选；费用审计检查输入/输出 token 和估算费用是否处于 1 美元目标内。未提供报告时输出 `not_evaluated`，未提供用量时输出 `not_available`，不会伪造模型效果或费用结论。当前人工精读是不同格式的内容，不应冒充新模型生成的报告。

## 解读质量人工对比

对 VOMMI HTML 和 UMI PDF 各生成一份真实 AI 报告后，逐项给出 **0=缺失、1=部分清楚、2=清楚且有正文定位、N/A=论文未提供**，并记录引用的具体原文位置：

| 检查项 | 重点问题 |
| --- | --- |
| 系统输入与输出 | 观测模态、动作维度、坐标系、频率/延迟是否说清；未披露则明确标注 |
| 方法信息流 | 从感知到决策、动作和再次观测的闭环能否沿框架图讲通 |
| 数据与训练 | 一条示教样本的字段、单位、监督来源、损失及训练/推理差异是否可核对 |
| 实验与数字 | 任务、载体、指标、具体数字、基线与失败情形是否逐项附证据 |
| 局限与推断 | 论文事实、作者承认的局限和站点工程建议是否分明 |
| MFM-VL 三阶段 | 桌面臂、轮式平台、轮足机械狗的迁移条件及验收项是否具体；未验证的 WBC 不得写成已验证 |
| 图像标注 | 论文原图是否匹配同版本图号/图注/地址；自绘图是否明确标为重绘 |

脚本中的原文字符串匹配只能证明**引文可定位**，不能证明中文断言被引文支持。人工仍需核对语义、实验条件及图片内容。解析阶段给出的费用数字只是字符数估算和最小合成调用预留额，不是最终 API 账单；真实 token 用量需要由生成任务返回。
