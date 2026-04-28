/**
 * 优雅的自动登录+签到脚本 (TypeScript 版)
 * 运行方式: node checkin.ts (需要 Node.js 24+)
 */

// 定义类型接口 (Interfaces)
// 相比 JSDoc，interface 更清晰、可复用
interface CardItem {
    label: string;
    value: string;
    highlight?: boolean;
}

interface NotifyData {
    type: 'success' | 'info' | 'error';
    title: string;
    items: CardItem[];
}

interface ApiResult {
    status?: string;
    message?: string;
    data?: {
        token?: string;
        auth_data?: string;
        reward_mb?: number;
        total_checkin_traffic?: number;
    };
}

// ================= 环境变量验证 =================
// 提前验证必需的环境变量，避免运行时才发现缺失
const USER_EMAIL = process.env.USER_EMAIL
const USER_PASSWORD = process.env.USER_PASSWORD
const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN

if (!USER_EMAIL || !USER_PASSWORD) {
    console.error('❌ 缺少环境变量 USER_EMAIL 或 USER_PASSWORD')
    process.exit(1)
}

// ================= 日志工具 =================
const log = (emoji: string, message: string): void => {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    console.log(`[${timestamp}] ${emoji} ${message}`)
}

const logError = (emoji: string, message: string, detail?: unknown): void => {
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    if (detail !== undefined) {
        console.error(`[${timestamp}] ${emoji} ${message}`, detail)
    } else {
        console.error(`[${timestamp}] ${emoji} ${message}`)
    }
}

// ================= 配置与工具 =================

const CONFIG = {
    BASE_URL: 'https://flzt.top',
    UA: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
}

const formatTraffic = (bytes: number): string => {
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

// ================= 视图层 (View) =================

const renderCard = (type: 'success' | 'info' | 'error', data: CardItem[]): string => {
    const isSuccess = type === 'success'
    const color = isSuccess ? '#52c41a' : (type === 'info' ? '#faad14' : '#f5222d')
    const icon = isSuccess ? '🎉' : (type === 'info' ? '📅' : '🚨')
    const titleMap = {success: '签到成功', info: '今日已签', error: '运行失败'}

    return `
    <div style="max-width: 400px; margin: 0 auto; font-family: -apple-system, sans-serif;">
      <div style="background: linear-gradient(135deg, ${color}, ${color}dd); color: white; padding: 15px; border-radius: 12px 12px 0 0; font-weight: bold; font-size: 16px;">
        <span>${icon}</span> ${titleMap[type]}
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

const sendNotification = async (title: string, content: string): Promise<void> => {
    if (!PUSHPLUS_TOKEN) return
    try {
        await fetch('https://www.pushplus.plus/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: PUSHPLUS_TOKEN, title, content, template: 'html'}),
        })
        log('✅', '推送已发送')
    } catch (e) {
        // TS 中 catch 的 error 默认为 unknown，需要断言
        const err = e as Error
        logError('❌', `推送失败: ${err.message}`)
    }
}

const login = async (): Promise<string> => {
    log('🔐', `登录中: ${USER_EMAIL}...`)
    const res = await fetch(`${CONFIG.BASE_URL}/api/v1/passport/auth/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'User-Agent': CONFIG.UA},
        body: JSON.stringify({email: USER_EMAIL, password: USER_PASSWORD})
    })

    // 使用泛型告诉 TS 返回值是什么结构
    const json = await res.json() as ApiResult

    if (!json.data?.auth_data && !json.data?.token) throw new Error(json.message || '登录失败')
    return (json.data.auth_data || json.data.token)!
}

const checkIn = async (token: string): Promise<{ ok: boolean, data: ApiResult }> => {
    log('🚀', '执行签到...')
    const res = await fetch(`${CONFIG.BASE_URL}/api/v1/user/checkIn`, {
        headers: {authorization: token, 'User-Agent': CONFIG.UA}
    })
    try {
        return {ok: res.ok, data: await res.json() as ApiResult}
    } catch {
        return {ok: res.ok, data: {message: '非 JSON 响应'}}
    }
}

// ================= 业务处理层 (Service) =================

const processCheckInResult = (isOk: boolean, result: ApiResult): NotifyData => {
    if (isOk && result.status === 'success') {
        const reward = (result.data?.reward_mb || 0) + ' MB'
        const total = formatTraffic(result.data?.total_checkin_traffic || 0)

        log('✅', `签到成功: ${reward}`)
        return {
            type: 'success',
            title: '机场签到成功 🎉',
            items: [
                {label: '获得流量', value: reward, highlight: true},
                {label: '剩余总额', value: total},
                {label: '账号', value: USER_EMAIL},
                {label: '状态', value: result.message || 'Success'}
            ]
        }
    }

    if (result.message && result.message.includes('already checked in')) {
        log('⚠️', '今日已签到')
        return {
            type: 'info',
            title: '机场今日已签 ✅',
            items: [
                {label: '账号', value: USER_EMAIL},
                {label: '提示', value: result.message},
                {label: '时间', value: new Date().toLocaleTimeString('zh-CN')}
            ]
        }
    }

    logError('❌', '签到失败:', result)
    throw new Error(result.message || JSON.stringify(result))
}

// ================= 主程序 (Main) =================

const run = async () => {
    try {
        const token = await login()
        const {ok, data} = await checkIn(token)
        const notifyData = processCheckInResult(ok, data)

        const htmlContent = renderCard(notifyData.type, notifyData.items)
        await sendNotification(notifyData.title, htmlContent)

    } catch (e) {
        const error = e as Error
        logError('❌', '运行异常:', error.message)
        const errorHtml = renderCard('error', [
            {label: '错误信息', value: error.message, highlight: true},
            {label: '账号', value: USER_EMAIL}
        ])
        await sendNotification('脚本运行失败 🚨', errorHtml)
        process.exit(1)
    }
}

run()