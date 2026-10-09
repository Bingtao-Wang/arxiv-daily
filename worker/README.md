# AI 论文解读 Worker

Cloudflare Worker 提供 GitHub 登录、异步任务状态和公开报告。D1 中的报告独立于 GitHub Pages 构建；站点每天更新不会删除报告。只有 GitHub 用户 `Bingtao-Wang`（数字 ID `90967361`）可以发起生成。读报告无需登录。

## 部署

1. 在 GitHub 创建 **GitHub App**，安装范围只选 `Bingtao-Wang/arxiv-daily`。Repository permissions 只需 **Actions: Read and write**（GitHub 默认的 Metadata read 也会显示）。设置 Web application callback URL 为 `https://<worker-host>/auth/callback`，启用 OAuth user authorization。记录 App ID、Client ID、Client Secret、Installation ID，并下载 App private key。
2. `cd worker && npm install && npx wrangler login`。运行 `npx wrangler d1 create arxiv-daily-ai`，把返回的 `database_id` 写入 `wrangler.toml`。将 App/Installation ID、Client ID、前端来源和仓库信息填入该文件。生产 `ALLOWED_ORIGINS` 保持站点来源；本地开发时用单独的本地变量覆盖，勿把 localhost 发布到生产。
3. GitHub 下载的 private key 如为 `BEGIN RSA PRIVATE KEY`，先在本机执行 `openssl pkcs8 -topk8 -nocrypt -in github-app.pem -out github-app-pkcs8.pem`。Worker 使用 WebCrypto，只接受输出为 `BEGIN PRIVATE KEY` 的 PKCS#8 PEM。通过 `npx wrangler secret put GITHUB_APP_PRIVATE_KEY` 写入完整 PEM。再分别写入 `GITHUB_APP_CLIENT_SECRET`、`CALLBACK_SECRET`（至少 32 个随机字符）。不要将密钥提交到仓库。
4. 运行 `npm run db:migrate`、`npm run check`、`npm test`、`npm run deploy`。确认 Worker URL 与 GitHub App callback URL 完全一致。
5. 仓库 Actions 配置变量 `AI_READING_API_BASE=https://<worker-host>`，Secrets 配置相同的 `AI_READING_CALLBACK_SECRET` 和独立的 `OPENAI_API_KEY`。网页构建设置 `VITE_AI_API_BASE=https://<worker-host>`；GitHub Pages 必须重新构建一次才能让按钮连到 Worker。`generate-reading.yml` 接受 Worker 下发的任务、论文编号和一次性运行令牌；回调还需共享密钥签名。`gpt-6.1-sol` 是否对该 API key 可用，以及实际价格，需要部署时核对。

可用 `openssl rand -hex 32` 生成回调密钥。不要把 GitHub App 私钥或 API key 放入 `VITE_*` 环境变量，因为它们会进入公开网页。

## 接口

- `GET /api/session`：返回 `{authenticated,canGenerate,loginUrl}`。前端把 OAuth 弹窗指向 `loginUrl`。成功时回调页面向允许的前端来源发送 `{type:"arxiv-daily-auth",token,expiresAt}`；失败发送 `{type:"arxiv-daily-auth-error",message}`。前端应核验 `event.origin` 等于 Worker 来源，把 token 存在 `sessionStorage`，并在后续请求设置 `Authorization: Bearer <token>`。令牌 1 小时后失效；D1 仅存 SHA-256 哈希。
- `GET /api/reports`：返回 `{ids:string[]}`，供列表“已有 AI 解读”标识和筛选。`GET /api/reports/:arxivId` 返回 `{report,sourceVersion,publishedAt}`。`GET /api/papers/:arxivId` 返回 `{report: {report,sourceVersion,publishedAt}|null, job: Job|null}`；报告与最新任务状态并存，失败任务不会遮蔽已发布报告。
- `POST /api/papers/:arxivId/generate` 或 `POST /api/jobs`：仅允许已登录管理员和允许的浏览器 Origin。前者可忽略请求体，后者接受 `{arxivId}`。返回 `{job}`；同一论文活跃任务返回原任务并附 `reused:true`。全站一次只运行 1 篇，北京时间每天最多发起 5 篇。任务超过 90 分钟无更新时，每 10 分钟运行的 Worker cron 将其标为失败。
- `GET /api/jobs/:jobId`：返回公开任务状态 `{id,arxivId,status,stage?,createdAt,updatedAt,sourceVersion?,error?,usage?}`。`status` 为 `queued|running|succeeded|failed`。
- `POST /api/internal/jobs/:jobId`：GitHub Actions 回调。请求头 `X-Callback-Timestamp` 为毫秒 Unix 时间，`X-Callback-Nonce` 为随机 URL 安全字符串，`X-Callback-Signature` 为 `sha256=` 加小写十六进制 HMAC-SHA256。签名输入是 **`${timestamp}.${nonce}.${rawBody}`** 的 UTF-8 字节，密钥为 `CALLBACK_SECRET`。时间偏差不得超过 5 分钟；nonce 在 D1 防重放。请求体 `{jobId,arxivId,runToken,status:"running"|"succeeded"|"failed",stage?,sourceVersion?,report?,error?,usage?}`。`jobId`、`arxivId` 必须与 Worker 任务一致，`runToken` 必须匹配 Worker 派发时送入 Actions 的任务令牌（D1 只保存哈希）；手动触发但没有令牌的工作流在模型调用前被拒绝。成功报告必须有锁定版本的 arXiv 全文证据；若附原图，原图地址也必须属于同版本，结构校验通过后才发布。

API 错误均返回 `{error,message}`，使用 HTTP 401、403、409、429 等状态码。报告由 Action 生成，Worker 存为 JSON；人工精读优先级由网页决定。
