/**
 * 优雅的自动登录+签到脚本 (强类型版)
 * @author xpsu
 * @description 使用 JSDoc 提供完整的类型检查和代码补全
 */

// @ts-check
// ↑ 这一行会让编辑器开启严格类型检查，像写 TS 一样检查 JS

const USER_EMAIL = process.env.USER_EMAIL
const USER_PASSWORD = process.env.USER_PASSWORD
const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN

// ================= 类型定义 (Type Definitions) =================

/**
 * @typedef {Object} CardItem
 * @property {string} label - 显示的标签名
 * @property {string} value - 显示的数值
 * @property {boolean} [highlight] - 是否高亮显示 (可选)
 */

/**
 * @typedef {Object} NotifyData
 * @property {'success' | 'info' | 'error'} type - 通知的类型
 * @property {string} title - 通知的标题
 * @property {CardItem[]} items - 卡片内容列表
 */

/**
 * @typedef {Object} ApiResult
 * @property {string} [status] - 状态 (success/fail)
 * @property {string} [message] - 服务端消息
 * @property {Object} [data] - 数据载荷
 * @property {string} [data.token] - 登录返回的 Token
 * @property {string} [data.auth_data] - 登录返回的 Token (旧版)
 * @property {number} [data.reward_mb] - 获得的流量 (MB)
 * @property {number} [data.total_checkin_traffic] - 总流量 (Bytes)
 */

// ================= 配置与工具 =================

const CONFIG = {
  BASE_URL: "https://flzt.top",
  UA: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"
}

/**
 * 流量格式化工具
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的 GB 字符串
 */
const formatTraffic = (bytes) => (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'

// ================= 视图层 (View) =================

/**
 * 渲染 HTML 卡片
 * @param {'success' | 'info' | 'error'} type - 卡片类型
 * @param {CardItem[]} data - 数据列表
 * @returns {string} HTML 字符串
 */
const renderCard = (type, data) => {
  const isSuccess = type === 'success'
  // 这里的类型推断会非常准确
  const color = isSuccess ? '#52c41a' : (type === 'info' ? '#faad14' : '#f5222d')
  const icon = isSuccess ? '🎉' : (type === 'info' ? '📅' : '🚨')
  const titleMap = {success: '签到成功', info: '今日已签', error: '运行失败'}

  return `
    <div style="max-width: 400px; margin: 0 auto; font-family: -apple-system, sans-serif;">
      <div style="background: linear-gradient(135deg, ${color}, ${color}dd); color: white; padding: 15px; border-radius: 12px 12px 0 0; font-weight: bold; font-size: 16px;">
        ${titleMap[type]} <span>${icon}</span> 
      </div>
      <div style="background: #fff; border: 1px solid #eee; border-top: none; padding: 20px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        ${data.map(item => `
          <div style="margin-bottom: 10px; font-size: 14px; color: #555; display: flex; align-items: center;">
            <span style="width: 70px; color: #888;">${item.label}:</span>
            <span style="font-weight: 500; color: #333; ${item.highlight ? `color: ${color}; font-weight: bold; font-size: 16px;` : ''}">${item.value}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

// ================= 网络层 (Network) =================

/**
 * 发送推送通知
 * @param {string} title
 * @param {string} content
 * @returns {Promise<void>}
 */
const sendNotification = async (title, content) => {
  if (!PUSHPLUS_TOKEN) return
  try {
    await fetch("https://www.pushplus.plus/send", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        token: PUSHPLUS_TOKEN,
        title,
        content,
        template: "html"
      }),
    })
    console.log("✅ 推送已发送")
  } catch (e) {
    // 这里的 e 在 JS 里默认是 any，我们可以强制类型转换
    const err = /** @type {Error} */ (e)
    console.error(`❌ 推送失败: ${err.message}`)
  }
}

/**
 * 登录获取 Token
 * @returns {Promise<string>} 返回 Token 字符串
 */
const login = async () => {
  console.log(`🔐 登录中: ${USER_EMAIL}...`)
  const res = await fetch(`${CONFIG.BASE_URL}/api/v1/passport/auth/login`, {
    method: "POST",
    headers: {"Content-Type": "application/json", "User-Agent": CONFIG.UA},
    body: JSON.stringify({email: USER_EMAIL, password: USER_PASSWORD})
  })

  /** @type {ApiResult} */
  const json = await res.json()

  if (!json.data?.auth_data && !json.data?.token) throw new Error(json.message || "登录失败")
  return json.data.auth_data || json.data.token || ""
}

/**
 * 执行签到请求
 * @param {string} token
 * @returns {Promise<{ok: boolean, data: ApiResult}>}
 */
const checkIn = async (token) => {
  console.log("🚀 执行签到...")
  const res = await fetch(`${CONFIG.BASE_URL}/api/v1/user/checkIn`, {
    headers: {
      authorization: token,
      "User-Agent": CONFIG.UA
    }
  })
  try {
    return {ok: res.ok, data: await res.json()}
  } catch {
    return {ok: res.ok, data: {message: "非 JSON 响应"}}
  }
}

// ================= 业务处理层 (Service) =================

/**
 * 处理签到结果
 * @param {boolean} isOk - HTTP 状态是否 OK
 * @param {ApiResult} result - API 返回的数据
 * @returns {NotifyData} 格式化后的通知数据
 */
const processCheckInResult = (isOk, result) => {
  // 场景 1: 成功
  if (isOk && result.status === "success") {
    // 即使 data 可能为空，JSDoc 也会提示你需要处理，这里我们用 Optional Chaining
    const reward = (result.data?.reward_mb || 0) + ' MB'
    const total = formatTraffic(result.data?.total_checkin_traffic || 0)

    console.log(`✅ 签到成功: ${reward}`)
    return {
      type: 'success',
      title: '机场签到成功 🎉',
      items: [
        {label: '获得流量', value: reward, highlight: true},
        {label: '剩余总额', value: total},
        {label: '账号', value: USER_EMAIL || '未知'},
        {label: '状态', value: result.message || 'Success'}
      ]
    }
  }

  // 场景 2: 重复
  if (result.message && result.message.includes("already checked in")) {
    console.log("⚠️ 今日已签到")
    return {
      type: 'info',
      title: '机场今日已签 ✅',
      items: [
        {label: '账号', value: USER_EMAIL || '未知'},
        {label: '提示', value: result.message},
        {label: '时间', value: new Date().toLocaleTimeString('zh-CN')}
      ]
    }
  }

  // 场景 3: 失败
  console.error("❌ 签到失败:", result)
  throw new Error(result.message || JSON.stringify(result))
}

// ================= 主程序 (Main) =================

const run = async () => {
  // 1. 检查配置
  if (!USER_EMAIL || !USER_PASSWORD) {
    console.error("❌ 缺环境变量")
    process.exit(1)
  }

  try {
    // 2. 线性执行业务
    const token = await login()
    const {ok, data} = await checkIn(token)

    // 3. 处理结果 (生成通知数据)
    const notifyData = processCheckInResult(ok, data)

    // 4. 渲染并推送 (数据 -> 视图)
    const htmlContent = renderCard(notifyData.type, notifyData.items)
    await sendNotification(notifyData.title, htmlContent)

  } catch (e) {
    const error = /** @type {Error} */ (e)
    // 5. 统一错误处理
    console.error("❌ 运行异常:", error.message)
    const errorHtml = renderCard('error', [
      {label: '错误信息', value: error.message, highlight: true},
      {label: '账号', value: USER_EMAIL || '未知'}
    ])
    await sendNotification("脚本运行失败 🚨", errorHtml)
    process.exit(1)
  }
}

run()