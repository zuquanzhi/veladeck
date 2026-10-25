# RunOtter 项目上下文

本地目录：D:/program/runotter。
GitHub：https://github.com/zuquanzhi/runotter。

RunOtter 是本对话主任务。用户要求开发初版、推送 GitHub 并通过 Actions/Release 生成 APK。

当前：M0–M7 核心工作流与 M8 分发代码已实现，15 项自动化测试、生产构建、真实 HTTP smoke 和手机 Chrome 界面 QA 已通过。运行时依赖审计为零漏洞。Android 构建和 Release 将由 GitHub Actions 实际执行；不得把配置完成等同于构建完成。

运行基线：Node 22 LTS。品牌为 RunOtter，SPEC.md 中 Agent Dock 是原始代号。安全修复所需的版本变更见 DECISIONS.md。原始开发包与来源校验记录保留在 Axiom 资源目录，未复制邮件信息或设备运行凭据到此仓库。

本版是可自托管的预览版，APK 使用 Android Custom Tabs 连接用户填写的 HTTPS 地址。未部署云端服务，未验证真实 DSH、手机后台推送和硬件通行密钥。其余原始规格差距和真机清单见 DECISIONS.md、VALIDATION.md 与 README.md。
