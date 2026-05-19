import "dotenv/config";
import * as fs from "fs";

async function main() {
  const TELEGRAM_API = "https://api.telegram.org/bot";
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId   = process.env.TELEGRAM_CHAT_ID!;

  const videoPath = "D:/tiktok-product-video-factory/outputs/the-six-sigma-secret-behind-ottoflow-s-video-production-syst/the-six-sigma-secret-behind-ottoflow-s-video-production-syst.mp4";
  const cbKey     = "0863d135-3320-4b"; // 16 chars — exactly what the fix uses

  const stat = fs.statSync(videoPath);
  console.log("Video file:", videoPath);
  console.log("Size:", (stat.size / 1024).toFixed(1), "KB");
  console.log("cbKey:", cbKey, "len:", cbKey.length);
  console.log("approve:cbKey len:", `approve:${cbKey}`.length);

  const formData = new FormData();
  const buffer   = fs.readFileSync(videoPath);
  const blob     = new Blob([buffer], { type: "video/mp4" });

  formData.append("chat_id",    chatId);
  formData.append("video",      blob, "six-sigma.mp4");
  formData.append("caption",    "🎬 V2 Test — Gemini + Veo3 + ElevenLabs");
  formData.append("parse_mode", "Markdown");
  formData.append("supports_streaming", "true");
  formData.append("reply_markup", JSON.stringify({
    inline_keyboard: [[
      { text: "✅ Approve", callback_data: `approve:${cbKey}` },
      { text: "❌ Reject",  callback_data: `reject:${cbKey}`  },
      { text: "🔄 Retry",  callback_data: `retry:${cbKey}`   },
    ]],
  }));

  console.log("\nSending...");
  const res  = await fetch(`${TELEGRAM_API}${botToken}/sendVideo`, { method: "POST", body: formData });
  const data = await res.json() as any;
  console.log("HTTP status:", res.status);
  console.log("ok:", data.ok);
  if (!data.ok) {
    console.log("error:", data.description);
    console.log("error_code:", data.error_code);
  } else {
    console.log("message_id:", data.result?.message_id);
    console.log("SUCCESS — video sent to Telegram");
  }
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
