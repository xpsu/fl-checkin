// index.js
const axios = require('axios');

// 从环境变量读取配置，保密性第一！
// 这些变量稍后会在 GitHub 仓库的 Secrets 中配置
const COOKIE = process.env.MY_COOKIE;
const PUSH_PLUS_TOKEN = process.env.PUSH_PLUS_TOKEN; // 选填，用于微信推送

// 模拟签到函数
async function doCheckIn() {
  console.log('🚀 开始执行签到任务...');

  if (!COOKIE) {
    console.error('❌ 错误：未找到 COOKIE 环境变量，请在 GitHub Secrets 中配置。');
    process.exit(1); // 退出并报错
  }

  try {
    // ⚠️ 这里替换成你要签到网站的真实 API 地址和 Header
    // 技巧：在浏览器 F12 网络面板找到签到请求，右键 -> Copy as Node.js fetch 这里的代码能参考
    const targetUrl = 'https://flzt.top/api/v1/user/checkin';

    const response = await axios.post(targetUrl, {}, {
      headers: {
        'Cookie': COOKIE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...' // 建议加上 UA
      }
    });

    // 假设 API 返回 { code: 200, msg: "签到成功" }
    // 你需要根据实际返回结构修改判断逻辑
    const data = response.data;

    if (data.code === 200 || data.success) {
      const msg = `✅ 签到成功！消息：${data.msg}`;
      console.log(msg);
      await sendNotification(msg);
    } else {
      const msg = `⚠️ 签到失败，接口返回：${JSON.stringify(data)}`;
      console.log(msg);
      await sendNotification(msg);
    }

  } catch (error) {
    const errorMsg = `❌ 请求出错：${error.message}`;
    console.error(errorMsg);
    await sendNotification(errorMsg);
    process.exit(1); // 让 Action 显示红色失败状态
  }
}

// 简单的推送通知函数（这里以 PushPlus 为例，免费好用）
// 如果不需要推送，可以把这里删掉
async function sendNotification(content) {
  if (!PUSH_PLUS_TOKEN) {
    console.log('ℹ️ 未配置推送 Token，跳过推送环节');
    return;
  }

  try {
    await axios.post('http://www.pushplus.plus/send', {
      token: PUSH_PLUS_TOKEN,
      title: '每日签到脚本汇报',
      content: content
    });
    console.log('📨 通知推送已发送');
  } catch (e) {
    console.error('❌ 推送发送失败', e.message);
  }
}

// 执行主函数
doCheckIn();