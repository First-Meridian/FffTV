# 项目协作约定

- 用户要求：每轮对话只要修改了项目代码，完成适当验证后主动创建一次 Git 提交，并在回复中给出提交编号。没有代码改动时不创建空提交。
- 仅提交本轮任务的改动；保留其他未授权改动，不提交 `.env.local`、数据库、依赖或构建产物。
- 推送使用当前仓库配置的远程地址；禁止强制推送或覆盖远程历史。本轮明确要求提交至远程时，同时完成推送并核实提交一致。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
