import "dotenv/config";
import { TelegramApprovalBot } from "../src/agents/approval/telegram-bot";
import { slugify } from "../src/lib/slug-utils";

// Send an already-rendered video for Telegram approval without re-rendering
const VIDEO_PATH = process.argv[2];
const TOPIC      = process.argv[3] ?? "Video";

async function main() {
  if (!VIDEO_PATH) {
    console.error("Usage: npx tsx scripts/send-for-approval.ts <video-path> [topic]");
    process.exit(1);
  }
  const bot  = new TelegramApprovalBot();
  const slug = slugify(TOPIC);
  console.log(`Sending to Telegram for approval...`);
  console.log(`  Video: ${VIDEO_PATH}`);
  console.log(`  Topic: ${TOPIC}`);
  console.log(`  Slug:  ${slug}`);
  const result = await bot.sendVideoForApproval(VIDEO_PATH, TOPIC, slug);
  console.log(`Decision: ${result.decision} (waited ${Math.round(result.waitTimeMs / 1000)}s)`);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
