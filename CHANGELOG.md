# Changelog

本文件记录 API 文档的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.14.0] - 2026-06-26

### 新增

- **举报系统** (`Reports`)
  - `POST /reports` - 提交举报（支持投票/推文/评论/推文评论）
  - `GET /reports/check` - 检查是否已举报

- **放逐提案** (`Ostracism`)
  - `GET /ostracism` - 获取放逐提案列表
  - `POST /ostracism` - 发起放逐提案
  - `POST /ostracism/resolve` - 结算过期提案
  - `GET /ostracism/{id}` - 获取提案详情
  - `POST /ostracism/{id}/second` - 附议提案
  - `POST /ostracism/{id}/defense` - 提交自辩
  - `POST /ostracism/{id}/vote` - 投票

- **用户屏蔽** (`Blocks`)
  - `GET /blocks` - 获取屏蔽列表
  - `POST /blocks/{id}` - 屏蔽/取消屏蔽

- **条件投票类型** (`conditional`)
  - 投票创建支持 `formConfig` 多步骤逻辑表单
  - 投票提交支持 `responses` 格式
  - 投票详情返回 `conditionalResults`、`funnelData`、`flowData`

- **管理后台扩展** (`Admin`)
  - `GET /admin/reports` - 获取举报列表
  - `PUT /admin/reports/{id}` - 处理举报（驳回/封禁）
  - `GET /admin/bans` - 获取封禁列表
  - `DELETE /admin/bans/{id}` - 提前解封
  - `GET /users/{id}/ban-status` - 查询封禁状态

### 变更

- **投票类型** - 新增 `conditional` 条件投票类型
- **投票详情** - 返回 IRV/Schulze 排序结果（`irvResult`、`schulzeResult`）
- **推文列表** - 自动过滤被屏蔽用户的帖子
- **举报处理** - 支持 `reviewNote` 审核备注字段
- **封禁列表** - 返回执行封禁的管理员信息
- **用户资料** - 返回绑定账号信息（`boundAccount`）
- **投票选项** - 草稿状态才可修改选项
- **置顶功能** - 仅管理员可设置投票置顶

### 修复

- 修复 `ErrorResponse` 循环引用问题
- 修复 Scalar 渲染 YAML MIME 类型问题（改用 JSON）

## [1.0.0] - 2026-06-22

### 新增

- **认证模块** (`Auth`)
  - `POST /auth/login` - 邮箱密码登录
  - `POST /users` - 注册新用户

- **投票模块** (`Polls`)
  - `GET /polls` - 获取投票列表（支持搜索、主题筛选）
  - `POST /polls` - 创建新投票
  - `GET /polls/{id}` - 获取投票详情
  - `PUT /polls/{id}` - 更新投票
  - `DELETE /polls/{id}` - 删除投票
  - `POST /polls/{id}/clone` - 克隆投票为草稿
  - `GET /polls/{id}/export` - 导出投票为 CSV
  - `POST /polls/{id}/share` - 分享投票计数

- **投票操作** (`Votes`)
  - `GET /polls/{id}/vote` - 获取当前用户投票状态
  - `POST /polls/{id}/vote` - 提交投票

- **投票评论** (`Poll Comments`)
  - `GET /polls/{id}/comments` - 获取评论列表
  - `POST /polls/{id}/comments` - 发表评论
  - `DELETE /polls/{id}/comments` - 删除评论

- **推文模块** (`Posts`)
  - `GET /posts` - 获取推文列表
  - `POST /posts` - 发表推文
  - `GET /posts/{id}` - 获取推文详情
  - `PUT /posts/{id}` - 更新推文
  - `DELETE /posts/{id}` - 删除推文

- **推文操作** (`Post Likes` / `Post Comments`)
  - `POST /posts/{id}/likes` - 点赞推文
  - `DELETE /posts/{id}/likes` - 取消点赞
  - `GET /posts/{id}/comments` - 获取评论列表
  - `POST /posts/{id}/comments` - 发表评论
  - `DELETE /posts/{id}/comments` - 删除评论

- **用户资料** (`Profile`)
  - `GET /profile` - 获取当前用户资料
  - `PUT /profile` - 更新个人资料
  - `PUT /profile/password` - 修改密码
  - `GET /profile/{id}` - 获取用户公开资料
  - `GET /profile/{id}/followers` - 获取粉丝列表
  - `GET /profile/{id}/following` - 获取关注列表
  - `GET /profile/{id}/votes` - 获取用户投票历史

- **关注系统** (`Follows`)
  - `POST /follows/{id}` - 关注用户
  - `DELETE /follows/{id}` - 取消关注

- **通知系统** (`Notifications`)
  - `GET /notifications` - 获取通知列表
  - `PUT /notifications` - 标记通知已读

- **会话管理** (`Sessions`)
  - `GET /sessions` - 获取登录设备列表
  - `POST /sessions` - 记录登录设备
  - `DELETE /sessions/{id}` - 删除登录设备

- **账号绑定** (`Bindings`)
  - `GET /bindings` - 获取绑定列表
  - `POST /bindings` - 发送绑定请求
  - `PUT /bindings/{id}` - 处理绑定请求
  - `DELETE /bindings/{id}` - 解绑账号

- **主题分类** (`Topics`)
  - `GET /topics` - 获取所有主题
  - `POST /topics` - 创建主题
  - `GET /topics/{id}` - 获取主题详情
  - `PUT /topics/{id}` - 更新主题
  - `DELETE /topics/{id}` - 删除主题

- **管理后台** (`Admin`)
  - `GET /admin/users` - 获取用户列表
  - `PUT /admin/users` - 更新用户角色
  - `GET /admin/stats` - 获取平台统计数据

- **账号设置** (`Settings`)
  - `PUT /settings/email` - 修改邮箱
  - `GET /settings/oauth` - 获取 OAuth 绑定状态
  - `POST /settings/oauth` - 发起 OAuth 绑定
  - `DELETE /settings/oauth/{provider}` - 解绑 OAuth

- **工具接口** (`Utility`)
  - `POST /turnstile` - 验证 Cloudflare Turnstile

### 技术栈

- OpenAPI 3.1.0
- Scalar API Reference
- GitHub Actions CI/CD
- GitHub Pages 部署
