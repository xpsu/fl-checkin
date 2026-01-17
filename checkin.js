/**
 * 优雅的自动登录+签到脚本 (最终完美版)
 * 适配 V2Board 面板
 * 依赖: Node.js 18+
 */

const USER_EMAIL = process.env.USER_EMAIL
const USER_PASSWORD = process.env.USER_PASSWORD
const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN

// ================= 配置区 =================
const CONFIG = {
  // 注意：根据你的脚本，域名是 flzt.top
  BASE_URL: "https://flzt.top",
  UA: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"
}

// 检查环境
if (!USER_EMAIL || !USER_PASSWORD) {
  console.error("❌ 错误: 环境变量缺失。请检查 USER_EMAIL 和 USER_PASSWORD")
  process.exit(1)
}

/**
 * 发起 PUSHPLUS 推送
 */
const sendNotification = async (title, content) => {
  if (!PUSHPLUS_TOKEN) return // 没配 Token 就不推
  try {
    await fetch("https://www.pushplus.plus/send", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        token: PUSHPLUS_TOKEN,
        title,
        content,
        template: "html",
      }),
    })
    console.log("✅ 微信推送请求已发送")
  } catch (e) {
    console.error(`❌ 推送失败: ${e.message}`)
  }
}

/**
 * 步骤1: 模拟登录获取 Token
 */
const login = async () => {
  const url = `${CONFIG.BASE_URL}/api/v1/passport/auth/login`
  console.log(`🔐 正在尝试登录: ${USER_EMAIL}...`)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CONFIG.UA
      },
      body: JSON.stringify({
        email: USER_EMAIL,
        password: USER_PASSWORD
      })
    })

    const result = await response.json()

    // 登录失败处理
    if (!result.data || (!result.data.token && !result.data.auth_data)) {
      throw new Error(`登录失败: ${result.message || "未获取到Token"}`)
    }

    // V2Board 有时候返回 token，有时候返回 auth_data
    const token = result.data.auth_data
    console.log("✅ 登录成功，Token 已获取")
    return token

  } catch (error) {
    throw new Error(`登录步骤异常: ${error.message}`)
  }
}

/**
 * 步骤2: 执行签到
 */
const checkIn = async (token) => {
  const timestamp = Date.now()
  const url = `${CONFIG.BASE_URL}/api/v1/user/checkIn?t=${timestamp}`

  const headers = {
    authorization: token,
    "Referer": `${CONFIG.BASE_URL}/dashboard`,
    "User-Agent": CONFIG.UA,
  }

  console.log(`🚀 开始签到: ${new Date().toLocaleString("zh-CN", {timeZone: "Asia/Shanghai"})}`)

  const response = await fetch(url, {method: "GET", headers: headers})

  let result
  try {
    result = await response.json()
  } catch (e) {
    if (!response.ok) throw new Error(`HTTP ${response.status}: 服务器炸了未返回 JSON`)
  }

  return {response, result}
}

/**
 * 主程序
 */
const run = async () => {
  try {
    // 1. 先登录
    const token = await login()

    // 2. 后签到
    const {response, result} = await checkIn(token)

    let notifyTitle = ""
    let notifyContent = ""

    // --- 场景 A: 签到成功 ---
    if (response.ok && result.status === "success") { // 注意：有些版本可能是 result.code === 200
      // 容错处理：有些旧版本字段可能不同
      const reward = result.data.reward_mb
      const total = (result.data.total_checkin_traffic / 1024 / 1024 / 1024).toFixed(2)

      console.log(`✅ 签到成功! 获得: ${reward}MB`)
      notifyTitle = "机场签到成功 🎉"
      notifyContent = `
        <div style="border: 1px solid #4caf50; padding: 10px; border-radius: 5px;">
          <p><b>获得流量:</b> <span style="color: #4caf50; font-weight: bold;">${reward} MB</span></p>
          <p><b>剩余总额:</b> ${total} GB</p>
          <p style="font-size: 12px; color: grey;">${result.message}</p>
        </div>
        `
      // --- 场景 B: 重复签到 ---
    } else if (result.message && result.message.includes("already checked in")) {
      console.log("⚠️ 今日已签到")
      notifyTitle = "机场今日已签到 ✅"
      notifyContent = `
        <div style="border: 1px solid #4caf50; padding: 10px; border-radius: 5px;">
          <p><b>账号:</b> <span style="color: #4caf50; font-weight: bold;">${USER_EMAIL}</span></p>
          <p style="font-size: 12px; color: grey;"> <b>服务端提示：</b>${result.message}</p>
        </div>
        `

      // --- 场景 C: 其他错误 ---
    } else {
      console.error("❌ 签到业务失败:", result)
      throw new Error(`服务端返回异常: ${result.message || JSON.stringify(result)}`)
    }

    await sendNotification(notifyTitle, notifyContent)

  } catch (error) {
    console.error("❌ 运行终止:", error.message)
    await sendNotification("机场脚本运行失败 🚨", `错误详情: ${error.message}`)
    process.exit(1)
  }
}

run()