// checkin.js

/**
 * 优雅的自动签到脚本 (支持 Pushplus 微信推送)
 * 依赖: Node.js 18+
 */

const TOKEN = process.env.USER_TOKEN
const COOKIE = process.env.USER_COOKIE
const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN // 新增: 获取 Pushplus Token

if (!TOKEN || !COOKIE) {
  console.error("❌ 错误: 环境变量缺失。请检查 USER_TOKEN 和 USER_COOKIE。")
  process.exit(1)
}

// 辅助函数：发送 Pushplus 通知
const sendNotification = async (title, content) => {
  if (!PUSHPLUS_TOKEN) {
    console.log("⚠️ 未配置 PUSHPLUS_TOKEN，跳过微信推送。")
    return
  }

  try {
    const url = "https://www.pushplus.plus/send"
    const response = await fetch(url, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        token: PUSHPLUS_TOKEN,
        title: title,
        content: content,
        template: "html" // 使用 HTML 模板以便换行和格式化
      })
    })

    const result = await response.json()
    if (result.code === 200) {
      console.log("✅ 微信推送成功")
    } else {
      console.log(`⚠️ 微信推送失败: ${result.msg}`)
    }
  } catch (e) {
    console.error(`❌ 推送请求异常: ${e.message}`)
  }
}

const runCheckIn = async () => {
  const timestamp = Date.now()
  const url = `https://flzt.top/api/v1/user/checkIn?t=${timestamp}`

  const headers = {
    "accept": "application/json, text/plain, */*",
    "authorization": `Bearer ${TOKEN}`,
    "content-type": "application/json",
    "cookie": COOKIE,
    "Referer": "https://flzt.top/dashboard",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
  }

  try {
    console.log(`🚀 开始签到: ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`)

    const response = await fetch(url, {method: "GET", headers: headers})

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const result = await response.json()
    let notifyTitle = ""
    let notifyContent = ""

    if (result.status === 'success' && result.data) {
      // 成功逻辑
      const reward = result.data.reward_mb
      const total = (result.data.total_checkin_traffic / 1024 / 1024 / 1024).toFixed(2)

      console.log(`✅ 签到成功! 获得: ${reward}MB, 总计: ${total}GB`)

      notifyTitle = "机场签到成功 ✅"
      notifyContent = [
        `<b>获得流量:</b> ${reward} MB`,
        `<b>累计签到:</b> ${total} GB`,
        `<b>签到时间:</b> ${new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}`,
        `<b>状态信息:</b> ${result.message}`
      ].join("<br>") // HTML换行

    } else {
      // 业务逻辑失败 (如重复签到)
      console.warn(`⚠️ 签到异常: ${result.message}`)

      notifyTitle = "机场签到异常 ⚠️"
      notifyContent = `服务端返回信息: ${result.message}<br>原始响应: ${JSON.stringify(result)}`
    }

    // 发送推送
    await sendNotification(notifyTitle, notifyContent)

  } catch (error) {
    console.error("❌ 脚本运行出错:", error.message)
    // 脚本出错也推送
    await sendNotification("机场签到脚本出错 ❌", `错误详情: ${error.message}`)
    process.exit(1)
  }
}

runCheckIn()