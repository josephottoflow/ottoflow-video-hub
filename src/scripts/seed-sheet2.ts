import "dotenv/config";
import { SheetsClient } from "../agents/sheets/client";

// Ottoflow: custom AI automation platform (n8n workflows, chatbots, data processing)
// Six Sigma: data-driven methodology targeting 3.4 defects per million, uses DMAIC framework
// Scripts: 30-35 words, 3-beat arc (Hook → Insight → CTA), professional tone, no em-dashes, ~12s spoken

// Paste any public .jpg face URL in avatarUrl — used by D-ID for talking head lipsync
const AVATAR_URL = ""; // e.g. https://example.com/avatar.jpg

const TOPICS = [
  {
    topic:     "How Ottoflow uses Six Sigma to eliminate content waste",
    style:     "Educational",
    voice:     "male professional",
    avatarUrl: AVATAR_URL,
    script: "Most content teams waste 40% of what they produce. Ottoflow runs its entire pipeline through Six Sigma's DMAIC framework. That's how you get consistent output with near-zero defects. Follow to see it.",
    hookA:  "Your content team is wasting 40% of its work",
    hookB:  "Six Sigma cuts defects to 3.4 per million. Ottoflow uses that on content",
    hookC:  "Could your content process survive a Six Sigma audit?",
  },
  {
    topic:     "The Six Sigma secret behind Ottoflow's video production system",
    style:     "Educational",
    voice:     "male professional",
    avatarUrl: AVATAR_URL,
    script: "Six Sigma targets 3.4 defects per million. That's the standard Ottoflow builds its video system to. Every clip, every caption, every post. Measured, improved, and scaled. Follow for more.",
    hookA:  "The secret behind Ottoflow's flawless video system",
    hookB:  "3.4 defects per million. That's the standard Ottoflow builds to",
    hookC:  "Most video teams guess. Ottoflow measures everything",
  },
  {
    topic:     "Why Ottoflow applies Six Sigma to social media content",
    style:     "Educational",
    voice:     "female professional",
    avatarUrl: AVATAR_URL,
    script: "Inconsistent content is what kills most social media channels. Ottoflow applies Six Sigma's DMAIC process to every video it publishes. No guesswork, no variation, just repeatable quality. Follow to learn more.",
    hookA:  "Inconsistent content is killing your social media growth",
    hookB:  "Six Sigma reduces variation. Ottoflow applies it to every post",
    hookC:  "Is your content process consistent enough to scale?",
  },
  {
    topic:     "How Six Sigma turned Ottoflow's content into a data-driven machine",
    style:     "Educational",
    voice:     "male professional",
    avatarUrl: AVATAR_URL,
    script: "Data beats guesswork every single time. Ottoflow runs its content through Six Sigma's Define, Measure, Analyze, Improve, and Control cycle. Every video gets measured and improved. That's how you scale. Follow for more.",
    hookA:  "Ottoflow stopped guessing and started measuring its content",
    hookB:  "DMAIC: the Six Sigma framework powering Ottoflow's content machine",
    hookC:  "What would happen if you measured every piece of content you made?",
  },
];

(async () => {
  const sheets = new SheetsClient("Sheet2");
  await sheets.initializeSheet();

  console.log("Clearing Sheet2...");
  await sheets.clearAllContent();
  console.log("Cleared.");

  for (const t of TOPICS) {
    const row = await sheets.addContent(t);
    // Write script + hooks immediately
    await sheets.updateScript(row, t.script, t.hookA, t.hookB, t.hookC);
    console.log(`  Row ${row}: ${t.topic}`);
    console.log(`    Script (${t.script.split(" ").length}w): ${t.script.substring(0, 80)}...`);
  }

  console.log("\nDone — 4 topics with scripts added to Sheet2.");
  process.exit(0);
})();
