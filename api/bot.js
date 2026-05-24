const TELEGRAM_API = "https://api.telegram.org";
const APP_VERSION = "chicks-v21";

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function getBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function withRefParam(url, refPayload) {
  if (!refPayload || !refPayload.startsWith("ref_")) return url;
  const glue = url.includes("?") ? "&" : "?";
  return `${url}${glue}ref=${encodeURIComponent(refPayload)}`;
}

function withAppVersion(url) {
  try {
    const nextUrl = new URL(url);
    nextUrl.searchParams.set("v", APP_VERSION);
    return nextUrl.toString();
  } catch {
    const glue = url.includes("?") ? "&" : "?";
    return `${url}${glue}v=${APP_VERSION}`;
  }
}

async function telegram(method, payload) {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is not configured");

  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data;
}

async function sendStartMessage(chatId, refPayload) {
  const webAppUrl = withRefParam(
    withAppVersion(process.env.WEBAPP_URL || "https://cipaclick.web.app"),
    refPayload
  );

  return telegram("sendMessage", {
    chat_id: chatId,
    text: "🐣 ЦыпКлик готов. Жми кнопку и начинай играть!",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Играть",
            web_app: { url: webAppUrl },
          },
        ],
      ],
    },
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return json(res, 200, { ok: true, service: "cypclick-bot" });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const update = getBody(req);
    const message = update.message || update.edited_message;
    const chatId = message && message.chat && message.chat.id;
    const text = (message && message.text) || "";

    if (!chatId) return json(res, 200, { ok: true, ignored: true });

    if (text.startsWith("/start")) {
      const refPayload = text.split(/\s+/)[1] || "";
      await sendStartMessage(chatId, refPayload);
      return json(res, 200, { ok: true });
    }

    await sendStartMessage(chatId, "");
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return json(res, 500, { ok: false, error: error.message });
  }
};
