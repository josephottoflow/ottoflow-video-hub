/**
 * CLI: Clear Google Sheet and populate with 15-second pre-written scripts.
 * No Anthropic API needed — all content is hardcoded below.
 * Usage: npx tsx src/cli/populate-sheet.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

import { SheetsClient } from "../agents/sheets/client";

// ─── Pre-written content — 15-second scripts (~35 words each) ─────────

const CONTENT = [
  {
    topic:  "What is Six Sigma in 15 seconds",
    style:  "Educational",
    voice:  "Female energetic",
    script: "Six Sigma means fewer than 3.4 defects per million. It is a quality standard invented at Motorola in the 1980s. GE saved twelve billion dollars using it. Today it runs healthcare, manufacturing, and tech worldwide. Follow for more.",
    hookA:  "Most companies fail 66 thousand times per million tries",
    hookB:  "99.99966% perfect — that is Six Sigma",
    hookC:  "You have never heard of Six Sigma but it runs your world",
  },
  {
    topic:  "The 3.4 defects rule explained",
    style:  "Educational",
    voice:  "Male calm",
    script: "At Six Sigma level only 3.4 defects happen per million. Most companies sit at 3 Sigma — that is 66,807 failures per million. The gap between those two numbers is the gap between safe and catastrophic. Save this.",
    hookA:  "Your company is failing 66 thousand times per million tries",
    hookB:  "3.4 vs 66,807 — this gap decides if companies survive",
    hookC:  "Would you fly on a plane built at 3 Sigma quality",
  },
  {
    topic:  "DMAIC explained simply",
    style:  "Educational",
    voice:  "Female calm",
    script: "DMAIC is the engine behind Six Sigma. Define. Measure. Analyze. Improve. Control. Most teams skip straight to improve and wonder why nothing sticks. DMAIC forces you to understand before you act. That discipline is why it works.",
    hookA:  "Most teams fix symptoms and call it solved — this fixes root causes",
    hookB:  "Five steps used by GE and Amazon to eliminate failures forever",
    hookC:  "Stop guessing why things break — this framework tells you exactly why",
  },
  {
    topic:  "Lean vs Six Sigma difference",
    style:  "Educational",
    voice:  "Male energetic",
    script: "Lean eliminates waste. Six Sigma eliminates variation. Lean asks: why does this step exist? Six Sigma asks: why does this step keep failing? Together they are the most powerful process improvement system in the world. Now you know.",
    hookA:  "Lean and Six Sigma are not the same — most people get this wrong",
    hookB:  "Waste vs variation — two problems, two very different tools",
    hookC:  "If your team argues Lean vs Six Sigma you are asking the wrong question",
  },
  {
    topic:  "Why companies fail without Six Sigma",
    style:  "Motivational",
    voice:  "Male energetic",
    script: "Without a quality framework companies repeat the same mistakes forever. Poor quality costs businesses 15 to 20 percent of revenue every year. That is money leaving through the back door. Six Sigma closes it. Do not let your business bleed out.",
    hookA:  "Your business is losing 20 percent of revenue to invisible mistakes",
    hookB:  "Poor quality costs companies one trillion dollars globally every year",
    hookC:  "You cannot scale a broken process — fix it first or fail bigger",
  },
  {
    topic:  "Six Sigma belts explained",
    style:  "Educational",
    voice:  "Female energetic",
    script: "Six Sigma uses a belt system just like martial arts. Green Belts run projects. Black Belts lead complex full-time programs. Master Black Belts design the entire strategy. Each level means deeper training and greater impact. Which belt are you aiming for?",
    hookA:  "Six Sigma has a belt system and most professionals do not know where they rank",
    hookB:  "There are five belt levels in Six Sigma — here is what each does",
    hookC:  "You might already qualify for a Six Sigma belt without realizing it",
  },
  {
    topic:  "Real example of process improvement",
    style:  "Case Study",
    voice:  "Male calm",
    script: "A hospital took 68 minutes to process emergency patients. After one Six Sigma project the time dropped to 31 minutes. Staff overtime costs fell by 200 thousand dollars. No new technology. No new hires. Just a better process.",
    hookA:  "A hospital cut patient wait times in half without spending extra money",
    hookB:  "68 minutes down to 31 — one project saved 200k per year",
    hookC:  "What if your biggest problem could be solved by mapping your current process",
  },
  {
    topic:  "Common mistakes in Six Sigma",
    style:  "Educational",
    voice:  "Female calm",
    script: "The biggest Six Sigma mistakes are simple. Skipping the Define phase. Using data to confirm what you already believe. Declaring victory too early. Most Six Sigma failures are not methodology failures. They are leadership failures. Save this.",
    hookA:  "Most Six Sigma projects fail and nobody talks about why",
    hookB:  "80 percent of Six Sigma failures come from three avoidable mistakes",
    hookC:  "Are you making these Six Sigma mistakes without knowing it",
  },
  {
    topic:  "What is process variation",
    style:  "Educational",
    voice:  "Male calm",
    script: "Process variation means your output is inconsistent — sometimes good, sometimes not. Common cause variation is normal. Special cause variation is unexpected. Six Sigma targets both. You cannot improve what you have not measured. Start there.",
    hookA:  "Inconsistency is killing your quality and you probably cannot see it",
    hookB:  "Two types of variation — only one can be eliminated immediately",
    hookC:  "If your process gives different results every time you do not have a process",
  },
  {
    topic:  "Six Sigma for startups",
    style:  "Startup-Focused",
    voice:  "Male energetic",
    script: "Startups think Six Sigma is only for big corporations. That is a costly mistake. One broken customer experience can end you before you scale. Define your core process. Measure what matters. Fix the biggest defect source. Repeat.",
    hookA:  "Startups that ignore quality do not get to become big companies",
    hookB:  "One bad customer experience costs five times more to recover from than to prevent",
    hookC:  "You think Six Sigma is not for startups — that thinking will kill your growth",
  },
  {
    topic:  "How Six Sigma increases profit",
    style:  "Case Study",
    voice:  "Female energetic",
    script: "GE saved 12 billion dollars in five years using Six Sigma. Motorola saved 16 billion over a decade. Fewer defects means less rework. Less rework means lower cost. Lower cost with the same revenue means higher margin. The numbers do not lie.",
    hookA:  "GE made 12 billion dollars in five years from one methodology",
    hookB:  "Every defect you ignore is costing you three to ten times its face value",
    hookC:  "What if improving your process was your highest ROI investment this year",
  },
  {
    topic:  "Data-driven decision making",
    style:  "Educational",
    voice:  "Male calm",
    script: "Most business decisions are made on gut feeling dressed up as experience. Six Sigma replaces gut with data. You measure the baseline. You find the root cause. Then you decide on evidence, not opinion. Better decisions, faster, less waste.",
    hookA:  "Your team is solving the wrong problems because you measure the wrong things",
    hookB:  "Companies that use data to decide are 23 percent more profitable on average",
    hookC:  "Stop trusting your gut on business decisions — here is what to trust instead",
  },
  {
    topic:  "What is a defect in Six Sigma",
    style:  "Educational",
    voice:  "Female calm",
    script: "In Six Sigma a defect is any output that fails to meet customer requirements. Not your internal standards. What the customer requires. A defect could be a late delivery, a wrong order, or a product that works but not as expected.",
    hookA:  "Your definition of defect is probably wrong and it is costing you customers",
    hookB:  "Most companies measure quality by their own standards not their customer's",
    hookC:  "What counts as a defect is decided by one person only — your customer",
  },
  {
    topic:  "Six Sigma in real life",
    style:  "Lifestyle",
    voice:  "Female energetic",
    script: "You use Six Sigma principles every day without knowing it. Checking your bank statement for errors. Batch cooking meals to save time. Tracking sleep to improve energy. The mindset of reducing variation applies to every system in your life.",
    hookA:  "You are already using Six Sigma in your daily life without knowing it",
    hookB:  "The world's top quality method was not designed for productivity — it was for factories",
    hookC:  "What if you applied Six Sigma thinking to your morning routine",
  },
  {
    topic:  "Why Six Sigma is still relevant today",
    style:  "Educational",
    voice:  "Male calm",
    script: "Some say Six Sigma is outdated in the age of AI. They are wrong. AI produces outputs. Six Sigma ensures those outputs meet quality standards. Agile ships fast. Six Sigma ensures what ships does not fail. The principle is timeless.",
    hookA:  "People say Six Sigma is dead — here is why they are completely wrong",
    hookB:  "AI makes processes faster — Six Sigma makes sure those processes do not fail",
    hookC:  "The methodology invented in 1986 is more important in 2025 than ever before",
  },
];

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log("🧹 Clearing Google Sheet...\n");

  const sheets = new SheetsClient();
  await sheets.initializeSheet();
  await sheets.clearAllContent();
  console.log("✅ Sheet cleared.\n");

  console.log("📝 Populating with 15-second scripts...\n");

  let added = 0;
  for (const item of CONTENT) {
    await sheets.addContent({
      topic:  item.topic,
      style:  item.style,
      voice:  item.voice,
      script: item.script,
      hookA:  item.hookA,
      hookB:  item.hookB,
      hookC:  item.hookC,
    });
    console.log(`➕ Added: "${item.topic}"`);
    added++;
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n✅ Done! ${added} rows added with 15-second scripts.`);
  console.log("Run the pipeline next:");
  console.log("  POST /api/pipeline");
}

main().catch((err) => {
  console.error("❌ Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
