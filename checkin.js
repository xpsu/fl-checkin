// checkin.js

/**
 * 优雅的自动签到脚本 (最终完美版)
 * 依赖: Node.js 18+
 */

const TOKEN = process.env.USER_TOKEN
const COOKIE = process.env.USER_COOKIE
const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN

if (!TOKEN || !COOKIE) {
  console.error("❌ 错误: 环境变量缺失。请检查 USER_TOKEN 和 USER_COOKIE。")
  process.exit(1)
}

const sendNotification = async (title, content) => {
  if (!PUSHPLUS_TOKEN) return
  try {
    const url = "https://www.pushplus.plus/send"
    await fetch(url, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(
        {
          token: PUSHPLUS_TOKEN,
          title,
          content,
          template: "html"
        })
    })
    console.log("✅ 微信推送请求已发送")
  } catch (e) {
    console.error(`❌ 推送失败: ${e.message}`)
  }
}

const runCheckIn = async () => {
  const timestamp = Date.now()
  const url = `https://flzt.top/api/v1/user/checkIn?t=${timestamp}`

  const headers = {
    "accept": "application/json, text/plain, */*",
    "authorization": `Bearer ${TOKEN}`,
    "cookie": COOKIE,
    "Referer": "https://flzt.top/dashboard",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  }

  try {
    console.log(`🚀 开始签到: ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`)

    const response = await fetch(url, {method: "GET", headers: headers})

    // 尝试解析返回的 JSON (无论 HTTP 状态码是多少)
    let result
    try {
      result = await response.json()
    } catch (e) {
      // 如果解析 JSON 失败，且状态码不对，那才是真的网络/服务器炸了
      if (!response.ok) throw new Error(`HTTP ${response.status}: 服务器未返回 JSON`)
    }

    let notifyTitle = ""
    let notifyContent = ""

    // --- 场景 1: 签到成功 (HTTP 200 + status success) ---
    if (response.ok && result.status === 'success') {
      const reward = result.data.reward_mb
      const total = (result.data.total_checkin_traffic / 1024 / 1024 / 1024).toFixed(2)
      console.log(`✅ 签到成功! 获得: ${reward}MB`)

      notifyTitle = "机场签到成功 ✅"
      notifyContent = `<b>获得:</b> ${reward} MB<br><b>总计:</b> ${total} GB<br><b>状态:</b> ${result.message}`

      // --- 场景 2: 已经签到过了 (HTTP 400 + status fail + 特定消息) ---
      // 服务端返回 400，但这是“假”错误，我们把它当“成功”处理
    } else if (result && result.message && (result.message.includes('already checked in') || result.message.includes('今天已签到'))) {
      console.log("⚠️ 提示: 今天已经签到过了，无需重复。")

      notifyTitle = "机场今日已签到 ⚠️"
      notifyContent = `脚本运行正常，服务端提示：<br>${result.message}<br>无需重复操作。`

      // --- 场景 3: 真正的错误 (Token过期、Cookie失效等) ---
    } else {
      console.error("❌ 签到失败 (业务异常):", result)
      throw new Error(`服务端返回异常: ${result.message || JSON.stringify(result)}`)
    }

    // 发送正常的推送结果
    await sendNotification(notifyTitle, notifyContent)

  } catch (error) {
    console.error("❌ 脚本运行致命错误:", error.message)
    await sendNotification("机场签到脚本报错 ❌", `错误详情: ${error.message}`)
    process.exit(1) // 标记 Action 为失败
  }
}

runCheckIn()