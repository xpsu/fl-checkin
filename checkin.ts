/**
 * 优雅的自动登录+签到脚本 (TypeScript 版)
 * 运行方式: npm start (需要 Node.js 24+)
 */

// ================= 基础类型定义 =================

/** API 响应状态 */
type ApiStatus = "success" | "fail";

/** 通用 API 响应结构（基于实际响应分析） */
interface ApiResponse<T = unknown> {
  status: ApiStatus;
  message: string;
  data: T | null;
  error: null; // 预留字段，当前 API 始终返回 null
}

/** 登录响应数据结构 */
interface LoginData {
  token: string; // 用户 token
  auth_data: string; // Bearer 格式的授权令牌
  is_admin: boolean; // 是否为管理员
}

/** 签到响应数据结构 */
interface CheckInData {
  reward: string; // 字节数（字符串）
  reward_mb: string; // MB 数（字符串）
  total_checkin_traffic: number; // 累计签到获得的总流量(字节)
}

/** 登录 API 响应 */
type LoginResponse = ApiResponse<LoginData>;

/** 签到 API 响应 */
type CheckInResponse = ApiResponse<CheckInData>;

// ================= UI 组件类型 =================

interface CardItem {
  label: string;
  value: string;
  highlight?: boolean;
}

interface NotifyData {
  type: "success" | "info" | "error";
  title: string;
  items: CardItem[];
}

// ================= 环境变量验证 =================

const USER_EMAIL = process.env.USER_EMAIL;
const USER_PASSWORD = process.env.USER_PASSWORD;
const PUSHPLUS_TOKEN = process.env.PUSHPLUS_TOKEN;

if (!USER_EMAIL || !USER_PASSWORD) {
  console.error("❌ 缺少环境变量 USER_EMAIL 或 USER_PASSWORD");
  process.exit(1);
}

// ================= 日志工具 =================

const getTimestamp = (): string =>
  new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

const log = (emoji: string, message: string): void => {
  console.log(`[${getTimestamp()}] ${emoji} ${message}`);
};

const logError = (emoji: string, message: string, detail?: unknown): void => {
  if (detail !== undefined) {
    console.error(`[${getTimestamp()}] ${emoji} ${message}`, detail);
  } else {
    console.error(`[${getTimestamp()}] ${emoji} ${message}`);
  }
};

// ================= 配置 =================

const CONFIG = {
  BASE_URL: "https://flzt.org",
  PUSHPLUS_URL: "https://www.pushplus.plus/send",
  UA: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.117 Safari/537.36",
  FETCH_TIMEOUT: 10000,
  FETCH_RETRIES: 3,
  FETCH_RETRY_DELAY: 1000,
};

// ================= 工具函数 =================

/**
 * 将字节数格式化为 GB 字符串
 * @param bytes - 字节数
 * @returns 格式化后的字符串，如 "1.50 GB"
 */
const formatTraffic = (bytes: number): string => {
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
};

/**
 * 带有超时和自动重试的 Fetch
 * - 超时：10 秒（AbortSignal.timeout）
 * - 重试：最多 3 次，指数退避（1s → 2s → 4s）
 * - 业务错误（400）不重试，网络错误才重试
 */
const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  retries = CONFIG.FETCH_RETRIES,
): Promise<Response> => {
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(CONFIG.FETCH_TIMEOUT),
    });

    if (!res.ok && res.status !== 400) {
      throw new Error(`HTTP ${res.status}`);
    }

    return res;
  } catch (error) {
    if (retries > 0) {
      const attempt = CONFIG.FETCH_RETRIES - retries + 1;
      const delay = CONFIG.FETCH_RETRY_DELAY * Math.pow(2, attempt - 1);
      log(
        "⏳",
        `${options.method || "GET"} ${url} 失败，${delay}ms 后第 ${attempt} 次重试`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
};

/**
 * 判断消息是否为"已签到"
 * @param message - API 返回的消息
 * @returns 是否包含已签到关键词
 */
const isAlreadyCheckedIn = (message: string): boolean =>
  message.toLowerCase().includes("already checked in");

// ================= 视图层 (View) =================

const renderCard = (
  type: "success" | "info" | "error",
  data: CardItem[],
): string => {
  const isSuccess = type === "success";
  const color = isSuccess ? "#52c41a" : type === "info" ? "#faad14" : "#f5222d";
  const icon = isSuccess ? "🎉" : type === "info" ? "📅" : "🚨";
  const titleMap = { success: "签到成功", info: "今日已签", error: "运行失败" };

  return `
    <div style="max-width: 400px; margin: 0 auto; font-family: -apple-system, sans-serif;">
      <div style="background: linear-gradient(135deg, ${color}, ${color}dd); color: white; padding: 15px; border-radius: 12px 12px 0 0; font-weight: bold; font-size: 16px;">
        <span>${icon}</span> ${titleMap[type]}
      </div>
      <div style="background: #fff; border: 1px solid #eee; border-top: none; padding: 20px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        ${data
          .map(
            (item) => `
          <div style="margin-bottom: 10px; font-size: 14px; color: #555; display: flex; align-items: center;">
            <span style="width: 70px; color: #888;">${item.label}:</span>
            <span style="font-weight: 500; color: #333; ${item.highlight ? `color: ${color}; font-weight: bold; font-size: 16px;` : ""}">${item.value}</span>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
};

// ================= 网络层 (Network) =================

/**
 * 发送 PushPlus 推送通知
 * @param title - 通知标题
 * @param content - HTML 格式内容
 */
const sendNotification = async (
  title: string,
  content: string,
): Promise<void> => {
  if (!PUSHPLUS_TOKEN) return;
  try {
    const res = await fetchWithRetry(CONFIG.PUSHPLUS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: PUSHPLUS_TOKEN,
        title,
        content,
        template: "html",
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    log("✅", "推送已发送");
  } catch (e) {
    const err = e as Error;
    logError("❌", `推送失败: ${err.message}`);
  }
};

/**
 * 用户登录，获取授权令牌
 * @returns Bearer 格式的 auth_data
 * @throws 登录失败时抛出错误
 */
const login = async (): Promise<string> => {
  log("🔐", `登录中: ${USER_EMAIL}...`);

  const res = await fetchWithRetry(
    `${CONFIG.BASE_URL}/api/v1/passport/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": CONFIG.UA },
      body: JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
    },
  );

  const json = (await res.json()) as LoginResponse;

  if (json.status !== "success" || !json.data?.auth_data) {
    throw new Error(json.message || "登录失败");
  }

  return json.data.auth_data;
};

/**
 * 执行签到请求
 * @param token - Bearer 格式的授权令牌
 * @returns 签到 API 响应数据
 * @throws HTTP 网络错误时抛出
 */
const checkIn = async (token: string): Promise<CheckInResponse> => {
  log("🚀", "执行签到...");

  const res = await fetchWithRetry(
    `${CONFIG.BASE_URL}/api/v1/user/checkIn`,
    {
      headers: { authorization: token, "User-Agent": CONFIG.UA },
    },
  );

  return (await res.json()) as CheckInResponse;
};

// ================= 业务逻辑层 (Service) =================

/**
 * 处理签到结果，生成通知数据
 * @param result - 签到 API 响应数据
 * @returns 通知数据对象
 * @throws 不可恢复的错误时抛出
 */
const processCheckInResult = (result: CheckInResponse): NotifyData => {
  // 签到成功场景
  if (result.status === "success" && result.data) {
    const reward = `${result.data.reward_mb} MB`;
    const total = formatTraffic(result.data.total_checkin_traffic);

    log("✅", `签到成功: ${reward}`);
    return {
      type: "success",
      title: "机场签到成功 🎉",
      items: [
        { label: "获得流量", value: reward, highlight: true },
        { label: "剩余总额", value: total },
        { label: "账号", value: USER_EMAIL },
        { label: "状态", value: result.message },
      ],
    };
  }

  // 今日已签到场景（status: fail，但消息包含 already）
  if (result.status === "fail" && isAlreadyCheckedIn(result.message)) {
    log("⚠️", "今日已签到");
    return {
      type: "info",
      title: "机场今日已签 ✅",
      items: [
        { label: "账号", value: USER_EMAIL },
        { label: "提示", value: result.message },
        { label: "时间", value: new Date().toLocaleTimeString("zh-CN") },
      ],
    };
  }

  // 其他失败场景
  logError("❌", "签到失败:", result);
  throw new Error(result.message || JSON.stringify(result));
};

// ================= 主程序 (Main) =================

const run = async () => {
  try {
    const token = await login();
    const result = await checkIn(token);
    const notifyData = processCheckInResult(result);

    const htmlContent = renderCard(notifyData.type, notifyData.items);
    await sendNotification(notifyData.title, htmlContent);
  } catch (e) {
    const error = e as Error;
    logError("❌", "运行异常:", error.message);

    const errorHtml = renderCard("error", [
      { label: "错误信息", value: error.message, highlight: true },
      { label: "账号", value: USER_EMAIL },
    ]);
    await sendNotification("脚本运行失败 🚨", errorHtml);
    process.exit(1);
  }
};

run();
