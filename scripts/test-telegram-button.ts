import "dotenv/config";
import { slugify } from "../src/lib/slug-utils";

async function main() {
  const TELEGRAM_API = "https://api.telegram.org/bot";
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId   = process.env.TELEGRAM_CHAT_ID!;

  const topic  = "The Six Sigma secret behind Ottoflow's video production system";
  const slug   = slugify(topic);
  const cbSlug = slug.slice(0, 55);

  console.log("slug:    ", slug, "len:", slug.length);
  console.log("cbSlug:  ", cbSlug, "len:", cbSlug.length);
  console.log("approve: ", `approve:${cbSlug}`, "len:", `approve:${cbSlug}`.length);

  const body = {
    chat_id: chatId,
    text: "Button data test",
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Approve", callback_data: `approve:${cbSlug}` },
        { text: "❌ Reject",  callback_data: `reject:${cbSlug}`  },
        { text: "🔄 Retry",  callback_data: `retry:${cbSlug}`   },
      ]],
    },
  };

  const res  = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log("Result:", JSON.stringify(data));
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
