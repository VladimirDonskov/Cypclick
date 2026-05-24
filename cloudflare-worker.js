const TELEGRAM_API = "https://api.telegram.org";
const REQUIRED_CHANNEL = "@CipochkaDev";
const REQUIRED_CHANNEL_URL = "https://t.me/CipochkaDev";
const APP_VERSION = "chicks-v21";

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

function getWebAppUrls(env, refPayload = "") {
  const primary = withAppVersion(env.WEBAPP_URL || "https://cipaclick.web.app");
  const fallback = withAppVersion(env.WEBAPP_FALLBACK_URL || "https://cipaclick.web.app");
  return {
    primaryUrl: withRefParam(primary, refPayload),
    fallbackUrl: withRefParam(fallback, refPayload),
  };
}

function subscriptionKeyboard(refPayload = "") {
  const callbackData = refPayload ? `check_sub:${refPayload}` : "check_sub";
  return {
    inline_keyboard: [
      [{ text: "Подписаться на канал", url: REQUIRED_CHANNEL_URL }],
      [{ text: "Проверить подписку", callback_data: callbackData.slice(0, 64) }],
    ],
  };
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

async function getBotInfo(env) {
  const data = await telegram(env, "getMe", {});
  return data.result || null;
}

async function checkSubscription(env, userId) {
  try {
    const data = await telegram(env, "getChatMember", {
      chat_id: REQUIRED_CHANNEL,
      user_id: userId,
    });
    const member = data.result || {};
    const subscribed = (
      member.status === "creator" ||
      member.status === "administrator" ||
      member.status === "member" ||
      (member.status === "restricted" && member.is_member === true)
    );
    return {
      ok: true,
      subscribed,
      status: member.status || "unknown",
      isMember: member.is_member,
    };
  } catch (error) {
    console.error("Subscription check failed", error);
    return {
      ok: false,
      subscribed: false,
      status: "error",
      error: error.message,
    };
  }
}

async function isSubscribed(env, userId) {
  const check = await checkSubscription(env, userId);
  return check.subscribed;
}

async function sendSubscriptionGate(env, chatId, refPayload = "") {
  return telegram(env, "sendMessage", {
    chat_id: chatId,
    text: "Чтобы открыть ЦыпКлик, подпишись на канал @CipochkaDev, а потом нажми «Проверить подписку».",
    reply_markup: subscriptionKeyboard(refPayload),
  });
}

async function sendGameMessage(env, chatId, refPayload = "") {
  const { primaryUrl, fallbackUrl } = getWebAppUrls(env, refPayload);

  return telegram(env, "sendMessage", {
    chat_id: chatId,
    text: "🐣 Подписка проверена. Жми кнопку и начинай играть!",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Играть",
            web_app: { url: primaryUrl },
          },
        ],
        [
          {
            text: "VPN / backup link",
            url: fallbackUrl,
          },
        ],
      ],
    },
  });
}

async function handleStart(env, chatId, userId, refPayload = "") {
  if (await isSubscribed(env, userId)) {
    return sendGameMessage(env, chatId, refPayload);
  }
  return sendSubscriptionGate(env, chatId, refPayload);
}

async function handleCallback(env, callbackQuery) {
  const callbackId = callbackQuery.id;
  const userId = callbackQuery.from && callbackQuery.from.id;
  const message = callbackQuery.message;
  const chatId = message && message.chat && message.chat.id;
  const data = callbackQuery.data || "";
  const refPayload = data.startsWith("check_sub:")
    ? data.slice("check_sub:".length)
    : "";

  if (!chatId || !userId) {
    await telegram(env, "answerCallbackQuery", {
      callback_query_id: callbackId,
    });
    return;
  }

  const sub = await checkSubscription(env, userId);
  if (sub.subscribed) {
    await telegram(env, "answerCallbackQuery", {
      callback_query_id: callbackId,
      text: "Подписка найдена. Открывай игру!",
    });
    await sendGameMessage(env, chatId, refPayload);
    return;
  }

  if (!sub.ok) {
    await telegram(env, "answerCallbackQuery", {
      callback_query_id: callbackId,
      text: "Бот не может проверить канал. Добавь его админом в @CipochkaDev.",
      show_alert: true,
    });
    return;
  }

  await telegram(env, "answerCallbackQuery", {
    callback_query_id: callbackId,
    text: "Сначала подпишись на @CipochkaDev.",
    show_alert: true,
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      let bot = null;
      try {
        bot = await getBotInfo(env);
      } catch (error) {
        return json({
          ok: false,
          service: "cypclick-bot",
          error: "BOT_TOKEN check failed",
          details: error.message,
        }, 500);
      }
      return json({ ok: true, service: "cypclick-bot", bot });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    try {
      const update = await request.json().catch(() => ({}));

      if (update.callback_query) {
        await handleCallback(env, update.callback_query);
        return json({ ok: true });
      }

      const message = update.message || update.edited_message;
      const chatId = message && message.chat && message.chat.id;
      const userId = message && message.from && message.from.id;
      const text = (message && message.text) || "";

      if (!chatId || !userId) return json({ ok: true, ignored: true });

      if (text.startsWith("/start")) {
        const refPayload = text.split(/\s+/)[1] || "";
        await handleStart(env, chatId, userId, refPayload);
        return json({ ok: true });
      }

      if (text.startsWith("/debug")) {
        const bot = await getBotInfo(env);
        const sub = await checkSubscription(env, userId);
        const urls = getWebAppUrls(env, "");
        await telegram(env, "sendMessage", {
          chat_id: chatId,
          text: [
            `Debug OK. Bot: @${bot.username}`,
            `User: ${userId}`,
            `Channel: ${REQUIRED_CHANNEL}`,
            `Subscription: ${sub.subscribed ? "yes" : "no"}`,
            `Status: ${sub.status}`,
            `WebApp: ${urls.primaryUrl}`,
            `Fallback: ${urls.fallbackUrl}`,
            sub.error ? `Error: ${sub.error}` : "",
          ].filter(Boolean).join("\n"),
        });
        return json({ ok: true });
      }

      await handleStart(env, chatId, userId, "");
      return json({ ok: true });
    } catch (error) {
      console.error(error);
      return json({ ok: false, error: error.message }, 500);
    }
  },
};
