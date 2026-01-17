# 飞龙机场每日自动签到

## 用法
1. fork 本仓库
2. 登录机场获取 `USER_TOKEN`
3. 登录 [push plus](https://www.pushplus.plus/push1.html) 获取`PUSHPLUS_TOKEN`
4. 在 GitHub Actions中添加Secrets
    ```
    Settings → Secrets and variables → Actions → New repository secret
    ```

`USER_TOKEN` 填机场网站的 token 

`PUSHPLUS_TOKEN` 填 [push plus](https://www.pushplus.plus/push1.html) 那里获取的 token
