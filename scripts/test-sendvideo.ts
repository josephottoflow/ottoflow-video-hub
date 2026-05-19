import "dotenv/config";
import * as fs from "fs";

async function main() {
  const TELEGRAM_API = "https://api.telegram.org/bot";
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId   = process.env.TELEGRAM_CHAT_ID!;

  const videoPath = "D:/tiktok-product-video-factory/outputs/the-six-sigma-secret-behind-ottoflow-s-video-production-syst/the-six-sigma-secret-behind-ottoflow-s-video-production-syst.mp4";
  const cbSlug    = "six-sigma-test"; // very short, definitely under 64 bytes

  console.log("Sending video with short cbSlug:", cbSlug);
  console.log("approve: len =", `approve:${cbSlug}`.length);

  const formData = new FormData();
  const buffer   = fs.readFileSync(videoPath);
  const blob     = new Blob([buffer], { type: "video/mp4" });

  formData.append("chat_id",    chatId);
  formData.append("video",      blob, "test-video.mp4");
  formData.append("caption",    "V2 test video");
  formData.append("parse_mode", "Markdown");
  formData.append("supports_streaming", "true");
  formData.append("reply_markup", JSON.stringify({
    inline_keyboard: [[
      { text: "Approve", callback_data: `approve:${cbSlug}` },
      { text: "Reject",  callback_data: `reject:${cbSlug}`  },
    ]],
  }));

  const res  = await fetch(`${TELEGRAM_API}${botToken}/sendVideo`, { method: "POST", body: formData });
  const data = await res.json() as any;
  console.log("ok:", data.ok);
  if (!data.ok) console.log("error:", data.description, "error_code:", data.error_code);
  else console.log("message_id:", data.result?.message_id);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
