# arXiv Daily

面向 **MFM-VL 机械臂项目**的论文跟踪与精读站：将“移动感知”扩展为“移动 + 实体操作”闭环，贯通数据采集、模型训练与真机部署。React 19、React Router、Vite、TypeScript，支持项目相关性排序、分阶段筛选、收藏、必看提示及带框架图的中文精读页。

项目按三阶段推进：**固定桌面机械臂操作基线 → 轮式平台场景操作 → 轮足机械狗复杂地形操作**。重点覆盖操作精度、工作空间适配、数据链路与全身控制（WBC）。具体目标、评分规则和阅读范围见 [项目画像与评分说明](docs/project-profile.md)。

## 本地运行

需要 Node.js >= 22.12。

```powershell
cd E:\GitHub\arxiv-daily
npm ci
npm run dev
```

打开 http://localhost:5173 。全新克隆会显示已核验经典论文示例，并明确标识为示例，不会将历史论文标成“今日”。

```powershell
npm test
npm run build
npm run preview
npm run fetch:preview -- --days 7 --max 500
npm run fetch:arxiv -- --days 7 --max 500
```

运行真实采集后，刷新开发页面即可读取新数据；生产环境需要重新 build。`--dry-run` 只检查获取结果，不修改数据。

## 数据和内容

- `shared/types.ts`：论文类型，保留原文摘要、发布日期、生成状态和解读依据。
- `shared/project.ts`：MFM-VL 三阶段画像、0–100 项目评分、原文证据和分阶段排序。
- `shared/reading.ts`：详细解析完整性与“必看”标记判定。
- `shared/static/data/papers.example.ts`：可提交的真实经典论文示例。
- `shared/static/data/papers.ts`：采集脚本生成的生产数据，gitignored；这是稳定的替换入口。
- `shared/static/data/readings.ts`、`control-readings.ts`、`vommi-reading.ts`：有原文定位的正文级精读、项目建议与自绘方法框架图数据。
- `shared/static/data/paper-figures.ts`、`classic-figures.ts`、`vommi-figures.ts`：论文原图的图号、中文导读、版本和来源信息。
- `shared/static/data/vommi-paper.ts`：VOMMI 经正文核验的稳定论文元数据与轮足载体证据。
- `client/public/paper-figures/SOURCES.md`：记录官方原图链接、图注和来源；同目录的本地研究副本被 Git 忽略，不随仓库发布。
- `shared/static/data/index.ts`：优先加载生产数据，缺失时使用示例。
- `scripts/`：arXiv Atom API / OAI-PMH 解析、相关性规则、合并去重、可选中文解读及验证。

论文日期使用 arXiv 原始发布日期；“今日/昨日/前日”按 Asia/Shanghai 的当前日历日期计算。页面另行显示最近采集时间。arXiv 可能存在发布延迟、周末或节假日空窗，因此今天没有新论文是正常情况。

关键词匹配只表示“值得读摘要的候选”，不等于学术质量判断。**阅读列表默认只显示综合相关性至少 50 分的论文**，按分数降序排列；选择阶段后还要求该阶段分数至少 50 分，并改按阶段分排序，也可切换为日期排序。最低分筛选可继续收紧到 70 或 85 分，“重置筛选”仍回到 50 分门槛。全局分数由操作精度与策略（20）、载体与工作空间（25）、数据链路（20）、训练到部署（20）、场景任务闭环（15）构成，详情页展示原文证据。全局分数与五维分数只依据英文标题和原始摘要；中文生成内容、项目建议、标签和旧采集分不会反向增加分数。

评分是可解释的阅读优先级启发式，不是模型能力、论文质量或工程成功率。相同关键词重复出现不会加分；纯导航、纯腿部运动控制与人形行走不会被当成完整机械臂操作闭环。四足 WBC 可获得第三阶段的控制基础参考分，仍须明确其与轮足＋机械臂联合验证的差别。

首页阶段标签根据 `stageMatches` 区分原文直接涉及的载体 / 操作主题、迁移参考与运动控制基础，不按分数猜测硬件。仅有方法迁移价值时显示“跨阶段方法参考”；原文只写移动操作而没有确定底盘类型时标注“底盘待核”，轮足运动基础也会注明缺少机械臂证据。对于已人工核验全文载体的个别论文，阶段标签和对应阶段分会用带出处的正文证据校正，**全局五维分不变**。例如 VOMMI 摘要只写移动操作，正文 §VI-A 明确在轮足 M20S＋CM1 机械臂上完成真机实验，因此第三阶段按轮足真机证据标注；它仍未给出轮足 WBC 算法。某阶段得分较高不表示论文已经验证该阶段的完整硬件系统。

检索范围包含 `cs.RO`，以及 `eess.SY` / `cs.SY` 中具有机器人、机械臂或轮足上下文的论文。关注 `robotic arm / manipulator`、`wheel-legged / wheeled-biped / wheeled-quadrupedal`、`whole-body control / WBC`。页面关键词可直接选择 **机械臂**、**轮足机器人**、**WBC**，WBC 缩写须有机器人上下文并排除白细胞语义；普通 MPC / QP 优化不独立触发召回。`scripts/arxiv.ts` 中原有上限 14 的规则分仅用于采集候选筛选，不作为页面项目相关性分数。

既有 PIPER、夹爪、鱼眼视觉与轮式底盘可作为工程参考条件；三阶段项目画像不预设后续载体已采购或适配完成。WBC 解读关注底盘—腿—臂协调、接触、平衡及运动 / 力矩约束，并注明哪些能力尚未被论文验证。

## 收藏与必看精读

首页卡片与论文详情页均可收藏 / 取消收藏，首页可勾选“只看收藏”。收藏以规范化 arXiv ID 去重，在当前浏览器的 `localStorage` 中保存 ID 和论文内容快照；刷新后保留，同源标签页同步。论文不在当前采集列表时，可使用收藏快照继续查看。实时数据可用时优先使用实时内容。首页收藏数与收藏列表也遵守 50 分门槛；历史收藏快照不会因门槛被删除。

收藏没有服务器账户或跨设备同步。不同浏览器、不同域名或端口（例如 `localhost` 与 `127.0.0.1`）的存储独立；清理站点数据会删除收藏。浏览器禁用存储或写入失败时，页面会提示当前选择仅保留在本次页面会话。

“必看”是已有完整精读的项目阅读推荐。只有标记推荐且具有实际解析章节、框架图和来源定位的记录才显示必看；高分或自动摘要本身不会生成必看标记。当前包含 **6 篇正文级精读**：

当前阅读列表中有 5 篇达到综合 50 分门槛；LLA-MPPI 的综合分较低，保留其全文精读与原链接供专项查阅，不占默认阅读列表。

| 论文 | 主要项目价值 |
| --- | --- |
| [ACT / Learning Fine-Grained Bimanual Manipulation](https://arxiv.org/abs/2304.13705) | 第一阶段桌面示范、动作块策略与闭环执行基线 |
| [UMI / Universal Manipulation Interface](https://arxiv.org/abs/2402.10329) | 采集接口、相对动作表示、视觉与执行延迟对齐 |
| [Mobile ALOHA](https://arxiv.org/abs/2401.02117) | 第二阶段轮式移动操作、全身遥操作与联合训练 |
| [RoboPace](https://arxiv.org/abs/2610.09696) | 接触感知动作重定时与机械臂策略执行层 |
| [LLA-MPPI](https://arxiv.org/abs/2610.10465) | 第三阶段 WBC 底层参考；验证载体为四足 Go2，未验证轮足＋机械臂 |
| [VOMMI](https://arxiv.org/abs/2610.08220) | 第二、三阶段便携双视角示教与轮足移动操作；验证 M20S＋CM1，未给出轮足 WBC |

精读分别标注论文事实、MFM-VL 落地建议和局限，提供方法拆解、数据与部署接口、实验边界、行动项和正文章节 / 图表定位。**默认展示论文原图与中文导读**：6 篇共 8 张原图，ACT 提供整体架构与附录网络图各 1 张，VOMMI 提供 Fig. 3 方法总览与 Fig. 2 双视角采集图，其余 4 篇各 1 张。每张图保留图号、作者、论文版本和来源链接；Mobile ALOHA 使用系统硬件原图，明确区别于模型网络图。自绘中文流程示意放在折叠的补充区，并注明**非论文原图**。

首页对达到 50 分门槛、已有精读和已核验原图的论文展示第一张原图预览。图片保持原始比例并延迟加载，标注图号和主题；点击预览进入精读页。图片加载失败时隐藏预览。新采集论文不会仅凭摘要自动提取或展示图片，需要人工核对正文图号、内容和来源后加入图集。

页面从论文的官方 arXiv HTML 地址直接加载原图，同时提供图注、官方原图和许可说明链接。原图请求失败时仍可点击来源链接查看。本地研究副本被 Git 忽略，不随公开仓库或 GitHub Pages 发布。arXiv 页面所标非独占分发许可不自动授予本站再分发权；原图版权仍归原权利人。

VOMMI 精读特别核对了便携双 RGB 采集与采集时位姿真值监督的区别、在线 / 离线 R2-VO、16 维联合动作、M20S＋CM1 真机结果和柜门任务退化。论文正文及摘要未提供可核实的 VOMMI 官方代码或数据集链接；站点不会把其使用的 VGGT、OpenPI 或 UMI 仓库误标为 VOMMI 开源实现。

经典基线保留原始发表日期，不伪装成当日新论文。低于 50 分的控制基础论文保留详情直链与已有精读，供专项查阅，不进入默认阅读列表或必看统计。

## 自动更新与托管

### 按需 AI 全文解读

尚无人工精读的论文详情页提供“解读该论文”。只有 GitHub 用户 `Bingtao-Wang` 能发起；所有访客都可以阅读生成完成的公开报告。报告标为**AI 自动生成、未经人工核验**，显示锁定的 arXiv 版本、原文摘录与定位、MFM-VL 实验建议及重绘框架示意；同版本 HTML 中图号、图注、图片地址匹配时才显示自动匹配的官方原图。人工精读始终优先，自动报告不会获得“必看”标记。首页的“已有 AI 解读”和“只看中文解读”筛选会读取公开报告目录。

自动精读借鉴 [kelip-paper-reading](https://github.com/skJack/kelip-paper-reading) 的六站阅读路线：**动机 → 架构 → 训练 → 数据 → 输入输出流 → 任务推演**，并补充实验结果、局限和 MFM-VL 三阶段迁移。新报告的目录可跳转到各站；缺乏原文依据的主题明确显示“未报告”，有依据的段落可展开摘录并打开锁定版本的原文定位。在线流程沿用本站的 HTML／Docling 解析、版本和图片校验，不自动克隆论文代码或发布 PDF 裁图。离线验收与其边界见 [AI 解读验收说明](docs/ai-reading-evaluation.md)。

此功能由 Cloudflare Worker/D1、独立 GitHub Actions 和 OpenAI API 共同提供。Worker 管理 GitHub App 登录、单任务并发、北京时间每日最多 5 篇及报告持久化；Action 优先解析 arXiv HTML，失败时使用 Docling 解析 PDF，再调用 `gpt-6.1-sol`。没有配置 Worker URL 时，页面会显示未配置状态，按钮无法发起任务。部署与密钥设置见 [Worker 部署说明](worker/README.md)；模型/解析实现与开源方案见 [方案清单](docs/open-source.md)。API 凭据和 GitHub App 私钥不得写入网页环境变量或仓库。

`.github/workflows/ci.yml` 在 push/PR 时执行测试和生产构建。

`.github/workflows/update-deploy.yml` 提供手动运行和每天**北京时间 09:00（UTC 01:00）**的定时采集、构建、GitHub Pages 部署；09:17 设有补跑触发，若当天已有成功更新则自动跳过。线上优先使用 arXiv 官方 OAI-PMH，失败时回退至官方 Atom API；本地默认顺序相反，可设置 `ARXIV_SOURCE=oai` 调整。两处都失败时不覆盖已有数据。成功部署后，线上页面显示新数据。GitHub 定时任务可能排队延迟或被丢弃，09:00 是启动计划时间，不保证页面在整点完成更新。工作流需推送到 GitHub 默认分支并启用 Pages 后才会定时运行。

启用步骤：

1. 把本地代码推送到自己的 GitHub 仓库。
2. 在 Settings → Pages 将 Source 设为 **GitHub Actions**。
3. 在 Actions 手动运行 **Update and deploy** 验证第一次部署。

当前 `http://127.0.0.1:5173` 是本机开发站，不会受 GitHub Pages 工作流更新。可执行 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/register-daily-update.ps1` 注册 Windows 计划任务 `ArxivDailyUpdate`，每天本机时间 09:00 采集并校验数据；用 `Get-ScheduledTaskInfo -TaskName ArxivDailyUpdate` 检查运行结果。电脑需开机、当前用户已登录并能访问 arXiv；错过时间后任务会在可运行时补跑。页面打开时可刷新查看更新。任务日志保存在 `work/daily-update/`。此任务只更新本地数据文件，不负责保持开发服务器常开。Windows 系统时区需设为 China Standard Time 才对应北京时间。

生产数据通过 Actions cache 跨次保留，并作为 90 天 artifact 备份，**不提交到代码仓库**。cache 可能被 GitHub 淘汰，若需永久历史库，应定期下载 artifact 或接入对象存储。抓取失败时工作流失败，已部署站点继续保留上一版。计划任务可能延迟，不承诺准确到分钟。

GitHub Pages 支持仓库子路径，构建时自动设置 base 并生成 404 fallback；首次直接打开深链会由 Pages 以 404 状态提供应用，客户端仍能正确显示论文。若要求所有深链返回 HTTP 200，可用 Cloudflare Pages（`client/public/_redirects`）或 Vercel（`vercel.json`）。

## 与设计文档的取舍

保留浅色、无动画、双列/单列、数据分离、项目关联、上一篇/下一篇等核心需求。当前静态界面使用原生 CSS，方法框架图随精读内容维护；未引入 Tailwind/shadcn。英文摘要可展开，筛选控件使用原生可访问表单。

文档的最新论文快照无法作为已经验证的元数据，本项目不编造 arXiv ID、作者或实验数字。妙搭专属部署/API 指令属于原平台材料，本实现独立运行，不会操作其中的应用或发送飞书消息。

开源方案、来源和选择依据见 `docs/open-source.md`。


## 可选本地中文模型

默认无需密钥即可采集。若需要自动中文翻译和**基于摘要的短评**，可安装开源 [Ollama](https://github.com/ollama/ollama)，准备可用的中文模型（如 `qwen2.5:14b`，按硬件选择大小）：

```powershell
Copy-Item .env.example .env
# 编辑 .env，取消 OLLAMA_MODEL 和 OLLAMA_BASE_URL 的注释
npm run fetch:arxiv -- --days 7 --max 500
```

`.env` 由 Node 加载且被 Git 忽略。脚本逐篇生成并严格检查中文字段、解读/关联段落长度、贡献条数和关联论文 ID。任何一篇失败都保留英文原文，并标记失败；已经人工整理的内容在后续采集中保留。模型不会自动安装，也不会自动下载大体积权重。

**Ollama 当前只接收标题和原始摘要，不自动下载、阅读或解析论文全文，也不自动生成正文级精读或必看框架图。** 生成内容在页面标注摘要依据。未配置模型时保留英文摘要并显示待翻译；新增全文精读需要另行核验正文、补齐来源与图示。

GitHub 托管 runner 默认没有 Ollama；自动部署默认更新英文元数据。如需每天自动生成中文，可使用预装模型的自托管 runner，并设置 `OLLAMA_MODEL` / `OLLAMA_BASE_URL`，或后续接入自己选择的模型服务。勿将未加鉴权的本地 Ollama 直接暴露到公网。
