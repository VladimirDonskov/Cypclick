const TELEGRAM_API = "https://api.telegram.org";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function withRefParam(url, refPayload) {
  if (!refPayload || !refPayload.startsWith("ref_")) return url;
  const glue = url.includes("?") ? "&" : "?";
  return `${url}${glue}ref=${encodeURIComponent(refPayload)}`;
}

async function telegram(env, method, payload) {
  if (!env.BOT_TOKEN) throw new Error("BOT_TOKEN is not configured");

  const response = await fetch(`${TELEGRAM_API}/bot${env.BOT_TOKEN}/${method}`, {
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

async function sendStartMessage(env, chatId, refPayload) {
  const webAppUrl = withRefParam(
    env.WEBAPP_URL || "https://cipaclick.web.app",
    refPayload
  );

  return telegram(env, "sendMessage", {
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

export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      return json({ ok: true, service: "cypclick-bot" });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    try {
      const update = await request.json().catch(() => ({}));
      const message = update.message || update.edited_message;
      const chatId = message && message.chat && message.chat.id;
      const text = (message && message.text) || "";

      if (!chatId) return json({ ok: true, ignored: true });

      if (text.startsWith("/start")) {
        const refPayload = text.split(/\s+/)[1] || "";
        await sendStartMessage(env, chatId, refPayload);
        return json({ ok: true });
      }

      await sendStartMessage(env, chatId, "");
      return json({ ok: true });
    } catch (error) {
      console.error(error);
      return json({ ok: false, error: error.message }, 500);
    }
  },
};
