# arXiv Daily 可复用开源方案

这份清单只记录已核验的公开仓库或官方文档。项目当前实现采用全 TypeScript 抓取脚本和 `fast-xml-parser`，没有复制第三方仓库代码；下面的仓库用于方案对比和故障排查参考。

## 抓取与数据更新

| 方案 | 链接 | 许可证/来源 | 取舍 |
| --- | --- | --- | --- |
| arXiv 官方 Atom API | [API 手册](https://arxiv.org/help/api/user-manual) · [cs.RO RSS](https://export.arxiv.org/rss/cs.RO) | arXiv 官方服务（按其服务条款使用） | API 可按分类、日期和排序查询；RSS 适合低频回退。生产任务应分页、去重并遵守请求间隔。 |
| `fast-xml-parser` | [GitHub](https://github.com/NaturalIntelligence/fast-xml-parser) · [npm](https://www.npmjs.com/package/fast-xml-parser) | MIT（以仓库 LICENSE 为准） | Node/TypeScript 原生 XML 解析，适合把 Atom 响应转成 `papers.ts`；需处理 Atom 单条/多条元素形态。 |
| `arxiv.py` | [lukasschwab/arxiv.py](https://github.com/lukasschwab/arxiv.py) · [PyPI](https://pypi.org/project/arxiv/) | MIT（以仓库 LICENSE 为准） | Python 客户端自带分页、延迟和重试；如果把更新脚本改成 Python，可减少 API 细节，但会引入 Python 运行时。 |

当前查询 `cs.RO`，并补充 `eess.SY` / `cs.SY` 中包含机器人、机械臂、腿式或轮式平台上下文的论文，覆盖机械臂与轮足机器人＋机械臂的 WBC。按 `submittedDate` 倒序拉取近 7 天并用无版本 arXiv ID 去重。API 日期边界按 UTC 处理，前端展示日期时再统一到项目约定的时区。

## 相关性筛选

| 方案 | 链接 | 许可证/来源 | 取舍 |
| --- | --- | --- | --- |
| 规则关键词 | 所提供设计文档第 7 节 | 本项目规则 | 依赖少、可复现、便于解释证据；标题和摘要中应做大小写、连字符与 Unicode 变体归一化。 |
| `sentence-transformers` | [GitHub](https://github.com/UKPLab/sentence-transformers) · [文档](https://www.sbert.net/) | Apache-2.0（仓库公开 LICENSE） | 可用多语言 MiniLM 做标题/摘要相似度；模型下载和 CI 缓存增加体积，建议作为关键词初筛后的可选二次排序。 |
| `arxiv-sanity-lite` | [karpathy/arxiv-sanity-lite](https://github.com/karpathy/arxiv-sanity-lite) | MIT（仓库 LICENSE） | 以摘要 TF-IDF 和 SVM 做推荐，适合参考离线索引和推荐流程；其 Flask/SQLite 整站架构与本项目 React 静态站不同，不直接移植。 |

当前项目先使用可解释的关键词分组和评分。若误报较多，再在脚本中增加 `sentence-transformers` 可选步骤，避免每天无条件下载模型。

## 定时与发布

项目的 GitHub Actions 工作流使用 UTC cron；北京时间 09:00 对应 UTC 01:00：

```yaml
on:
  schedule:
    - cron: '0 1 * * *'
  workflow_dispatch:
```

工作流建议固定 `actions/setup-node`、启用 `concurrency` 防止并发写数据，并让脚本只更新数据文件。若数据文件被 `.gitignore` 忽略，部署步骤必须显式上传生成物或使用构建 artifact，不能假设下一次 checkout 会包含它。

## 摘要翻译与本地模型（可选）

需要离线生成中文标题或解读时，可以把 [Ollama](https://github.com/ollama/ollama)（[MIT 许可证](https://github.com/ollama/ollama/blob/main/LICENSE)）作为本地兼容服务，再由独立脚本写入 `titleZh`、`analysis` 等字段。模型输出必须保留 `sourceAbstract`、`enrichmentStatus` 和 `analysisBasis`，并人工抽查术语；没有可核验全文时，不应把模型推测写成实验结论。模型权重的许可证应按所选模型单独检查。

## 示例数据核验

`shared/static/data/papers.example.ts` 的 6 篇示例均由 [arXiv Atom API 的批量 ID 查询](https://export.arxiv.org/api/query?id_list=2304.13705,2303.04137,2406.09246,2402.10329,2401.02117,2410.24164&max_results=20)核验，保留最初发布日期，并使用核验时最新版摘要（查询时刻：2026-10-09 北京时间）。`sourceAbstract` 保存 API 摘要原文，中文解读均标记 `analysisBasis: 'abstract'`，不能当作全文阅读结论。

| arXiv ID | 最初发布日期（UTC） | 核验时版本 |
| --- | --- | --- |
| [2303.04137](https://arxiv.org/abs/2303.04137) | 2023-03-07 | v5 |
| [2304.13705](https://arxiv.org/abs/2304.13705) | 2023-04-23 | v1 |
| [2401.02117](https://arxiv.org/abs/2401.02117) | 2024-01-04 | v1 |
| [2402.10329](https://arxiv.org/abs/2402.10329) | 2024-02-15 | v3 |
| [2406.09246](https://arxiv.org/abs/2406.09246) | 2024-06-13 | v3 |
| [2410.24164](https://arxiv.org/abs/2410.24164) | 2024-10-31 | v4 |

公开仓库许可证核验路径：[`fast-xml-parser/LICENSE`](https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/LICENSE)、[`arxiv.py/LICENSE.txt`](https://github.com/lukasschwab/arxiv.py/blob/master/LICENSE.txt)、[`arxiv-sanity-lite/LICENSE`](https://github.com/karpathy/arxiv-sanity-lite/blob/master/LICENSE)、[`sentence-transformers/LICENSE`](https://github.com/UKPLab/sentence-transformers/blob/master/LICENSE)。

## 取舍结论

- 小规模每日任务：官方 API + TypeScript `fast-xml-parser` + 关键词规则，依赖最少且可复现。
- 需要更高召回：在规则命中后可选多语言 sentence-transformers；缓存模型并保留命中证据。
- 需要 Python 生态：使用 `arxiv.py` 的分页/重试客户端，但不要同时维护两套抓取器。
- 第三方仓库只作为参考，当前项目不复制其代码、密钥或数据文件。
