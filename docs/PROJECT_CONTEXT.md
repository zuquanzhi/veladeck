# VelaDeck 项目上下文

本地目录：D:/program/runotter（保留原开发目录）。
GitHub：https://github.com/zuquanzhi/veladeck。

VelaDeck 是本对话主任务，首版发布名为 RunOtter，原始开发包代号为 Agent Dock。用户要求开发初版、推送 GitHub 并通过 Actions/Release 生成 APK，随后要求重做界面、Logo 和 README。用户已选定 VelaDeck 新名称与 B · Current 流动带图形。

M0–M7 核心工作流与 M8 分发代码已实现，v0.1.0 已通过 GitHub Actions 发布。v0.1.1 已统一新品牌、浅深色界面、响应式导航、矢量图标、Android 连接页及中英文 README。v0.1.2 已增加固定发布签名与应用内升级。用户随后明确要求手机端为真正原生 App；当前 v0.2.0 使用 Java/Android Views、HTTPS JSON/SSE、Keystore 会话与 Credential Manager，取代原浏览器壳，同时修复 Android 10 签名读取兼容性；最终验证与发布结果见 VALIDATION.md 和 GitHub Release。

运行基线：Node 22 LTS。安全修复所需的版本变更见 DECISIONS.md。原始开发包与来源校验记录保留在 Axiom 资源目录，未复制邮件信息或设备运行凭据到此仓库。GitHub 仓库通过更名保留历史；现有数据库与浏览器会话兼容策略见 GETTING_STARTED.md。

本版是可自托管的预览版，APK 使用原生页面直接访问用户填写的 HTTPS API 地址。未部署云端服务，未验证真实 DSH、手机后台推送和硬件通行密钥。其余原始规格差距和真机清单见 DECISIONS.md、VALIDATION.md 与 README.md。
