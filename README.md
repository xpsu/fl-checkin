# 🛫 飞龙机场每日自动签到

基于 TypeScript + Bun 编写的每日自动签到脚本，支持 PushPlus 微信推送。

## 🚀 快速开始

1. **Fork 本仓库**：点击右上角的 `Fork` 按钮，将仓库复制到你的账号下。
2. **获取推送 Token**：登录 [PushPlus 官网](https://www.pushplus.plus/push1.html) 获取 `PUSHPLUS_TOKEN`。
3. **配置环境变量**：
   进入仓库的 `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`，添加以下三个变量：

| 变量名              | 说明             | ⚠️ 重要提示                                                 |
|:-----------------|:---------------|:--------------------------------------------------------|
| `USER_EMAIL`     | 机场登录邮箱         | -                                                       |
| `USER_PASSWORD`  | 机场登录密码         | **直接填原始密码！不要加引号，不要转义 `\` 或 `$`** (GitHub Secrets 会自动处理) |
| `PUSHPLUS_TOKEN` | PushPlus Token | 用于接收签到结果通知                                              |

4. **启动**：配置完成后，去 `Actions` 页面手动触发一次，或者等待第二天自动运行。