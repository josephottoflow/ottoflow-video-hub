import "dotenv/config";
import { TelegramApprovalBot } from "../src/agents/approval/telegram-bot";

async function main() {
  const bot       = new TelegramApprovalBot();
  const videoPath = "D:/tiktok-product-video-factory/outputs/the-six-sigma-secret-behind-ottoflow-s-video-production-syst/the-six-sigma-secret-behind-ottoflow-s-video-production-syst.mp4";
  const topic     = "The Six Sigma secret behind Ottoflow's video production system";
  const cbKey     = "0863d135-3320-4b"; // same as what orchestrator would pass

  console.log("Calling sendVideoForApproval directly...");
  console.log("cbKey:", cbKey, "len:", cbKey.length);

  const result = await bot.sendVideoForApproval(videoPath, topic, cbKey);
  console.log("Decision:", result.decision);
  process.exit(0);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
