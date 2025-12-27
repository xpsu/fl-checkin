const axios = require('axios')

// 环境变量获取
const COOKIE = process.env.MY_COOKIE
const TOKEN = process.env.MY_TOKEN // 建议把 Authorization 放在这里
const PUSH_PLUS_TOKEN = process.env.PUSH_PLUS_TOKEN

async function doCheckIn() {
  console.log('🚀 开始执行签到任务 [fljc.cc]...')

  if (!COOKIE && !TOKEN) {
    console.error('❌ 错误：未找到 Cookie 或 Token，请检查 GitHub Secrets 配置。')
    process.exit(1)
  }

  try {
    // 动态生成时间戳，对应你抓到的 ?t=1766859062861
    const timestamp = new Date().getTime()
    const targetUrl = `https://fljc.top/api/v1/user/checkIn?t=${timestamp}`

    // ⚠️ 注意：根据你的抓包，这里改成了 GET 请求
    const response = await axios.get(targetUrl, {
      headers: {
        // 鉴权部分：优先使用 Token，如果没有则依赖 Cookie
        // 如果你的抓包里 Authorization 有值，请务必配置 MY_TOKEN
        ...(TOKEN ? {'Authorization': TOKEN} : {}),
        'Cookie': COOKIE,

        // 伪装部分
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://fljc.top/dashboard', // 更新为新域名
        'Origin': 'https://fljc.top',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      }
    })

    const data = response.data
    console.log('🔍 服务端返回原始数据:', JSON.stringify(data))

    // 获取北京时间
    const timeString = new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})

    // === 判断逻辑 (根据通常的 API 习惯调整) ===
    // 既然是 GET 请求，成功通常返回 { ret: 1 } 或 { data: true }
    // 如果失败或已签到，可能会有 { msg: "..." }
    const isSuccess = (data.ret === 1) || (data.data === true) || (JSON.stringify(data).includes("成功"))
    const isAlready = JSON.stringify(data).includes("已经") || JSON.stringify(data).includes("Already")

    if (isSuccess) {
      const trafficInfo = data.traffic ? `流量变动: ${data.traffic}` : ''
      const msg = `
        <h3 style="color: #2c3e50;">📅 [fljc] 签到成功</h3>
        <hr>
        <p><b>状态：</b> <span style="color: green;">✅ 成功</span></p>
        <p><b>时间：</b> ${timeString}</p>
        <p><b>结果：</b> ${trafficInfo}</p>
        <p><b>服务端消息：</b> ${data.msg || JSON.stringify(data)}</p>
      `
      console.log('✅ 签到成功')
      await sendNotification(msg)

    } else if (isAlready) {
      const msg = `
        <h3 style="color: #2c3e50;">📅 [fljc] 重复签到</h3>
        <hr>
        <p><b>状态：</b> <span style="color: orange;">👌 今日已签</span></p>
        <p><b>时间：</b> ${timeString}</p>
      `
      console.log('👌 今天已经签到过了')
      await sendNotification(msg)

    } else {
      // 失败情况
      const msg = `
        <h3 style="color: #2c3e50;">📅 [fljc] 签到失败</h3>
        <hr>
        <p><b>状态：</b> <span style="color: red;">❌ 失败</span></p>
        <p><b>时间：</b> ${timeString}</p>
        <p><b>错误信息：</b> ${JSON.stringify(data)}</p>
      `
      console.error('⚠️ 签到未成功')
      await sendNotification(msg)
    }

  } catch (error) {
    console.error('❌ 请求执行出错', error.message)
    const timeString = new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})

    // 如果是 403/401，通常是 Token 过期
    const errorDetail = error.response ? JSON.stringify(error.response.data) : error.message

    const msg = `
      <h3 style="color: #2c3e50;">📅 [fljc] 脚本报错</h3>
      <hr>
      <p><b>状态：</b> <span style="color: red;">❌ 程序异常</span></p>
      <p><b>时间：</b> ${timeString}</p>
      <p><b>详情：</b> ${errorDetail}</p>
      <p><b>建议：</b> 检查 Token 是否过期或域名是否变更。</p>
    `
    await sendNotification(msg)
    process.exit(1)
  }
}

// 推送函数保持不变
async function sendNotification(content) {
  if (!PUSH_PLUS_TOKEN) return
  try {
    await axios.post('http://www.pushplus.plus/send', {
      token: PUSH_PLUS_TOKEN,
      title: '每日签到通知',
      content: content,
      template: 'html'
    })
  } catch (e) {
    console.error('推送失败', e.message)
  }
}

doCheckIn()