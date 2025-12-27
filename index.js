// index.js
const axios = require('axios')

// 从环境变量读取配置，保密性第一！
// 这些变量稍后会在 GitHub 仓库的 Secrets 中配置
const COOKIE = process.env.MY_COOKIE
const token = process.env.PUSH_PLUS_TOKEN // 选填，用于微信推送

// 模拟签到函数
async function doCheckIn() {
  console.log('🚀 开始执行签到任务...')

  if (!COOKIE) {
    console.error('❌ 错误：未找到 COOKIE 环境变量')
    process.exit(1)
  }

  try {
    const targetUrl = 'https://flzt.top/api/v1/user/checkin'

    // 注意：这里保留了上一轮建议添加的 headers
    const response = await axios.post(targetUrl, {}, {
      headers: {
        'Cookie': COOKIE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      }
    })

    const data = response.data

    // 获取当前北京时间
    const timeString = new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})

    // === 情况 A: 签到成功 (根据实际返回判断，假设 1 或 true 代表成功) ===
    if (data && (data.ret === 1 || data.data === true || data.message === "Checkin Successful")) {
      // ⚠️注意：不同网站成功标识不一样，如果不知道，先看 Log

      console.log('✅ 签到成功')

      // 🟢 构造【绿色】成功消息
      const msg = `
        <h3 style="color: #2c3e50;">📅 每日签到报告</h3>
        <hr style="border: 1px dashed #ccc;">
        <p><b>状态：</b> <span style="color: green; font-weight: bold;">✅ 签到成功</span></p>
        <p><b>时间：</b> ${timeString}</p>
        <p><b>服务端返回：</b> <code style="background: #f4f4f4; padding: 2px 5px;">${JSON.stringify(data)}</code></p>
      `

      await sendNotification(msg)

    } else {
      // === 情况 B: 签到失败 (虽然请求通了，但业务逻辑失败，比如“已签到过”) ===
      console.error('⚠️ 签到异常')

      // 🟠 构造【橙色】警告消息
      const msg = `
        <h3 style="color: #2c3e50;">📅 每日签到报告</h3>
        <hr style="border: 1px dashed #ccc;">
        <p><b>状态：</b> <span style="color: orange; font-weight: bold;">⚠️ 签到异常</span></p>
        <p><b>时间：</b> ${timeString}</p>
        <p><b>原因：</b> <code style="background: #f4f4f4; padding: 2px 5px;">${JSON.stringify(data)}</code></p>
      `

      await sendNotification(msg)
    }

  } catch (error) {
    // === 情况 C: 请求直接报错 (比如 403, 404, 网络断了) ===
    console.error('❌ 请求出错', error.message)

    const timeString = new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})

    // 🔴 构造【红色】错误消息
    const msg = `
      <h3 style="color: #2c3e50;">📅 每日签到报告</h3>
      <hr style="border: 1px dashed #ccc;">
      <p><b>状态：</b> <span style="color: red; font-weight: bold;">❌ 执行出错</span></p>
      <p><b>时间：</b> ${timeString}</p>
      <p><b>错误信息：</b> ${error.message}</p>
      <p><b>提示：</b> 可能是 Cookie 过期或 IP 被拦截。</p>
    `

    await sendNotification(msg)
    process.exit(1) // 标记 Action 为失败
  }
}

// 简单的推送通知函数（这里以 PushPlus 为例，免费好用）
// 如果不需要推送，可以把这里删掉
// ⬇️ 这是一个通用的 PushPlus 推送函数
async function sendNotification(content) {

  if (!token) {
    console.log('⚠️ 未配置 PUSH_PLUS_TOKEN，跳过微信推送')
    return
  }

  try {
    console.log('📨 正在发送微信推送...')

    await axios.post('http://www.pushplus.plus/send', {
      token: token,
      title: '自动签到通知', // 消息标题
      content: content,      // 消息内容 (支持 HTML 或 纯文本)
      template: 'html'       // 使用 HTML 格式，这样内容换行更清晰
    })

    console.log('✅ 微信推送发送成功！')
  } catch (error) {
    console.error('❌ 微信推送失败:', error.message)
    // 这里不抛出异常，以免因为推送失败导致整个 Action 显示为失败（看你个人喜好）
  }
}
// 执行主函数
doCheckIn()