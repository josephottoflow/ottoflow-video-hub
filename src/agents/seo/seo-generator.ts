/**
 * SEO AGENT — Multi-platform caption, hashtag & hook generator
 * Fully rule-based — no API key required.
 * Keyword analysis + curated hashtag database + viral hook templates.
 */

import * as fs   from "fs";
import * as path from "path";

// === Types ===

export interface SeoOutput {
  title:       string;
  description: string;
  hashtags:    string[];
  hook:        string;
  cta:         string;
}

// === Category database ===

type Category =
  | "business" | "finance" | "tech" | "health" | "marketing"
  | "productivity" | "leadership" | "mindset" | "education" | "lifestyle";

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  business:     ["business", "startup", "entrepreneur", "revenue", "profit", "sales", "company", "brand", "customer", "market", "scale", "growth", "founder", "b2b", "saas", "ecommerce", "retail", "strategy"],
  finance:      ["finance", "money", "invest", "stock", "crypto", "budget", "debt", "saving", "wealth", "income", "passive", "dividend", "fund", "asset", "tax", "trading", "portfolio", "financial"],
  tech:         ["tech", "ai", "software", "code", "programming", "app", "developer", "machine learning", "automation", "data", "cloud", "api", "algorithm", "digital", "blockchain", "web", "saas"],
  health:       ["health", "fitness", "workout", "diet", "nutrition", "mental", "sleep", "exercise", "weight", "gym", "yoga", "wellness", "stress", "anxiety", "habit", "food", "calories", "body"],
  marketing:    ["marketing", "seo", "content", "social media", "ads", "campaign", "brand", "audience", "engagement", "funnel", "conversion", "copywriting", "viral", "influencer", "email", "growth hack"],
  productivity: ["productivity", "time", "focus", "habit", "routine", "morning", "goal", "system", "organize", "plan", "schedule", "workflow", "deep work", "distraction", "priority", "output", "efficiency"],
  leadership:   ["leadership", "management", "team", "culture", "ceo", "executive", "hire", "delegation", "decision", "vision", "mentor", "coaching", "performance", "feedback", "accountability"],
  mindset:      ["mindset", "motivation", "success", "discipline", "confidence", "resilience", "growth mindset", "believe", "failure", "win", "attitude", "overcome", "challenge", "purpose", "potential"],
  education:    ["learn", "education", "teach", "school", "skill", "knowledge", "study", "course", "training", "degree", "university", "certificate", "book", "read", "research", "expert", "master"],
  lifestyle:    ["lifestyle", "travel", "luxury", "design", "fashion", "minimalism", "home", "family", "relationship", "dating", "career", "work life", "balance", "remote", "freedom", "adventure"],
};

const CATEGORY_HASHTAGS: Record<Category, string[]> = {
  business:     ["entrepreneurship", "businesstips", "startuplife", "businessowner", "smallbusiness", "growthhacking", "b2b", "businessmindset", "ceolife", "hustle", "buildingabrand", "entrepreneurmindset", "businessstrategy", "scaleyourbusiness", "businesscoach"],
  finance:      ["financialliteracy", "financetips", "investing", "wealthmindset", "personalfinance", "moneymanagement", "financialfreedom", "stockmarket", "passiveincome", "buildwealth", "moneytips", "financialindependence", "invest", "budgeting", "richhabits"],
  tech:         ["technology", "techtips", "artificialintelligence", "aitools", "coding", "softwaredeveloper", "techstartup", "automation", "futureofwork", "machinelearning", "digitaltransformation", "techlife", "programming", "saas", "cloudcomputing"],
  health:       ["healthtips", "fitness", "wellness", "mentalhealth", "nutrition", "workout", "healthylifestyle", "selfcare", "gym", "weightloss", "mindfulness", "healthymind", "fitnessmotivation", "cleaneating", "wellbeing"],
  marketing:    ["digitalmarketing", "marketingtips", "contentmarketing", "socialmediamarketing", "growthhacking", "seo", "marketingstrategy", "emailmarketing", "onlinemarketing", "brandbuilding", "copywriting", "contentcreator", "marketingagency", "b2bmarketing"],
  productivity: ["productivity", "productivitytips", "timemanagement", "focusmode", "morningroutine", "habitbuilding", "deepwork", "getthingsdone", "worksmarter", "dailyroutine", "goalsetting", "selfimprovement", "lifehacks", "systemsthinking"],
  leadership:   ["leadership", "leadershipdevelopment", "management", "executivemindset", "teambuilding", "ceo", "corporatelife", "leadbyexample", "professionaldevelopment", "coaching", "leadershipskills", "businessleadership", "companyculture"],
  mindset:      ["mindset", "growthmindset", "motivation", "successmindset", "discipline", "selfimprovement", "mentalstrength", "positivity", "believeinyourself", "resilience", "successhabits", "mindsetshift", "powerofmind", "unstoppable"],
  education:    ["education", "learning", "lifelonglearning", "knowledgeispower", "studytips", "edtech", "onlinelearning", "skilldevelopment", "teacherstudents", "learneveryday", "curiosity", "personaldev", "upskill", "continuouslearning"],
  lifestyle:    ["lifestyle", "luxurylifestyle", "digitalnomad", "worklifebalance", "freedomlifestyle", "minimalism", "aestheticlife", "livelovelaugh", "slowliving", "intentionalliving", "lifestylegoals", "dreamlife", "adulting", "modernliving"],
};

const UNIVERSAL_HASHTAGS = ["fyp", "foryou", "viral", "trending", "learnontiktok", "shorts", "explore", "tipsandtricks"];

// === Hook templates ===

const HOOK_TEMPLATES = [
  (topic: string) => `Nobody tells you this about ${topic}...`,
  (topic: string) => `The truth about ${topic} they don't want you to know`,
  (topic: string) => `Stop ignoring ${topic} — here's why it matters`,
  (topic: string) => `I studied ${topic} for years. Here's what I found...`,
  (topic: string) => `This changed everything I knew about ${topic}`,
  (topic: string) => `POV: You just mastered ${topic} in under a minute`,
  (topic: string) => `3 things about ${topic} that will blow your mind`,
  (topic: string) => `If you understand ${topic}, you're ahead of 99% of people`,
  (topic: string) => `${topic} is not what you think it is...`,
  (topic: string) => `The ${topic} strategy top performers use daily`,
];

const CTA_TEMPLATES = [
  "Follow for more tips like this!",
  "Save this for later — you'll thank me!",
  "Share this with someone who needs to hear it!",
  "Comment below: did this help you?",
  "Follow for daily insights that actually work!",
  "Like + follow for more content like this!",
];

// === Platform caption rules ===

const PLATFORM_CONFIGS: Record<string, { maxHashtags: number; maxDesc: number; style: string }> = {
  tiktok:    { maxHashtags: 18, maxDesc: 2200, style: "casual" },
  instagram: { maxHashtags: 25, maxDesc: 2200, style: "visual" },
  youtube:   { maxHashtags: 5,  maxDesc: 5000, style: "detailed" },
  facebook:  { maxHashtags: 5,  maxDesc: 5000, style: "conversational" },
};

// === SEO Generator ===

export class SeoGenerator {

  /** Detect content categories from topic + style text. */
  private detectCategories(topic: string, style: string): Category[] {
    const text = `${topic} ${style}`.toLowerCase();
    const scores: [Category, number][] = (Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][])
      .map(([cat, kws]) => [cat, kws.filter((kw) => text.includes(kw)).length] as [Category, number])
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1]);

    return scores.length > 0 ? scores.slice(0, 3).map(([cat]) => cat) : ["education"];
  }

  /** Extract meaningful keywords from topic. */
  private extractKeywords(topic: string): string[] {
    const stop = new Set(["a","an","the","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","shall","can","about","how","what","why","when","where","this","that","these","those","their","they","it","its"]);
    return topic
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stop.has(w));
  }

  /** Build hashtag list for a given platform. */
  private buildHashtags(topic: string, style: string, platform: string): string[] {
    const cfg = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.tiktok;
    const categories = this.detectCategories(topic, style);
    const keywords = this.extractKeywords(topic);

    // Category-specific tags (deduplicated across top categories)
    const catTags = [...new Set(categories.flatMap((c) => CATEGORY_HASHTAGS[c]))];

    // Keyword tags derived from topic words
    const kwTags = keywords.map((kw) => kw.replace(/\s+/g, ""));

    const all = [...kwTags, ...catTags, ...UNIVERSAL_HASHTAGS];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const tag of all) {
      const clean = tag.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (clean && !seen.has(clean)) { seen.add(clean); result.push(clean); }
      if (result.length >= cfg.maxHashtags) break;
    }
    return result;
  }

  /** Pick the best available hook or generate one from templates. */
  private selectHook(topic: string, hooks: { a?: string; b?: string; c?: string }): string {
    const provided = [hooks.a, hooks.b, hooks.c].filter(Boolean) as string[];
    if (provided.length > 0) return provided[0];
    const idx = Math.abs(topic.charCodeAt(0) + topic.length) % HOOK_TEMPLATES.length;
    return HOOK_TEMPLATES[idx](topic);
  }

  /** Build a platform-appropriate description. */
  private buildDescription(topic: string, hook: string, platform: string, hashtags: string[]): string {
    const cfg = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.tiktok;
    const cta = CTA_TEMPLATES[topic.length % CTA_TEMPLATES.length];
    const tagLine = hashtags.map((h) => `#${h}`).join(" ");

    if (cfg.style === "detailed") {
      return `${hook}\n\nIn this video, we break down everything you need to know about ${topic}. Whether you're a beginner or looking to level up your understanding, this covers the key insights that actually make a difference.\n\nKey takeaways:\n• What ${topic} really means\n• Why it matters more than you think\n• How to apply it starting today\n\n${cta}\n\n${tagLine}`;
    }

    if (cfg.style === "conversational") {
      return `${hook}\n\nHonestly, ${topic} is one of those things most people overlook — and it costs them. In today's video I'm breaking down the essentials so you can stop making the same mistakes.\n\n${cta}\n\n${tagLine}`;
    }

    // casual / visual
    return `${hook} 💡\n\n${cta}\n\n${tagLine}`;
  }

  /** Generate SEO metadata for a single platform. */
  generate(
    topic: string,
    style: string,
    hooks: { a?: string; b?: string; c?: string },
    platform = "tiktok"
  ): SeoOutput {
    const hook     = this.selectHook(topic, hooks);
    const cta      = CTA_TEMPLATES[topic.length % CTA_TEMPLATES.length];
    const hashtags = this.buildHashtags(topic, style, platform);
    const title    = `${topic} — ${hook.length < 60 ? hook : hook.slice(0, 57) + "..."}`.slice(0, 150);
    const description = this.buildDescription(topic, hook, platform, hashtags);

    return { title, description, hashtags, hook, cta };
  }

  /** Generate metadata for all 4 platforms at once. */
  generateAllPlatforms(
    topic: string,
    style: string,
    hooks: { a?: string; b?: string; c?: string }
  ): Record<string, SeoOutput> {
    return Object.fromEntries(
      ["tiktok", "instagram", "youtube", "facebook"].map((p) => [p, this.generate(topic, style, hooks, p)])
    );
  }

  /** Generate and save metadata files to the output directory. */
  generateAndSave(
    topic: string,
    style: string,
    hooks: { a?: string; b?: string; c?: string },
    outputDir: string
  ): SeoOutput {
    const seo = this.generate(topic, style, hooks);
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(path.join(outputDir, "title.txt"), seo.title, "utf-8");
    // description already contains hook + cta + hashtags — write it directly
    fs.writeFileSync(path.join(outputDir, "caption.txt"), seo.description, "utf-8");
    fs.writeFileSync(
      path.join(outputDir, "hashtags.txt"),
      seo.hashtags.map((h) => `#${h}`).join(" "),
      "utf-8"
    );

    const allPlatforms = this.generateAllPlatforms(topic, style, hooks);
    fs.writeFileSync(
      path.join(outputDir, "seo-all-platforms.json"),
      JSON.stringify(allPlatforms, null, 2),
      "utf-8"
    );

    return seo;
  }
}
