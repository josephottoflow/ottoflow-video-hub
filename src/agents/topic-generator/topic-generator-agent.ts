import { getAIOrchestrator } from "../../ai-orchestrator";

export interface TopicSuggestion {
  topic:         string;   // The specific video angle — must work as a standalone hook
  style:         string;   // Content style
  angle:         string;   // Narrative structure
  hookPreview:   string;   // Max 8 words, creator-native hook
  curiosityType: string;   // "confession" | "documentary" | "pov" | "myth-bust" | "insider" | "controversial" | "transformation" | "warning"
  emotionalHook: string;   // Primary emotion triggered: "envy" | "fear" | "curiosity" | "validation" | "outrage" | "hope" | "guilt" | "surprise"
  originality:   number;   // 1-10 originality score (10 = truly unique, 1 = seen a million times)
}

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(
      /\b(the|a|an|how|why|what|when|where|who|is|are|was|were|to|of|for|in|on|at|by|with)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function deduplicate(
  suggestions: TopicSuggestion[],
  existing: string[]
): TopicSuggestion[] {
  const seen = new Set<string>();

  // Seed the seen-set with already-queued topics (normalized)
  for (const t of existing) {
    seen.add(normalizeTitle(t));
  }

  return suggestions.filter((s) => {
    const key = normalizeTitle(s.topic);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Main agent class
// ---------------------------------------------------------------------------

export class TopicGeneratorAgent {
  // -------------------------------------------------------------------------
  // generateTopics — primary method (same signature as before)
  // -------------------------------------------------------------------------
  async generateTopics(
    niche:        string,
    count         = 15,
    avoidTopics?: string[],
    opts?:        { tier?: "basic" | "advanced"; jobId?: string }
  ): Promise<TopicSuggestion[]> {
    const avoidList = avoidTopics?.length
      ? `\nAVOID these topics (already queued — do not produce anything semantically similar):\n${avoidTopics
          .slice(0, 30)
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

    const systemPrompt = `You are a viral content strategist who has built multiple 10M+ follower accounts on TikTok and Instagram Reels. You think exclusively in terms of scroll-stopping moments, emotional resonance, and creator authenticity — never SEO, never keywords, never corporate marketing.

Your topics are not headlines. They are video premises — specific emotional angles that make a creator look like they have insider knowledge or genuine lived experience. Every topic you generate must feel like it came from a real creator who has something genuine to say, not an AI recycling popular formats.

Your output must never include:
- "5 tips for..." or "3 ways to..."
- "The ultimate guide to..."
- "Everything you need to know about..."
- "How to [generic action]"
- Any phrasing that sounds like a blog title or SEO article

Your output must always feel like:
- A creator's genuine insight or confession
- A surprising truth that subverts what everyone else says
- A specific documented experience or transformation
- A curiosity-inducing premise that begs to be watched
- Content the viewer feels was made specifically for them`;

    const prompt = `NICHE: ${niche}
GENERATE: exactly ${count} creator-native viral topic ideas

CURIOSITY TYPE DISTRIBUTION — mix ALL of these across the ${count} topics:
- "confession" (2-3): Creator admits something uncomfortable or embarrassing about the niche
- "documentary" (2-3): Investigative reveal — "I tested X for 30 days and this happened"
- "pov" (2-3): POV scenarios that make the viewer see themselves in the situation
- "myth-bust" (2-3): Directly challenge the most commonly held belief in the niche
- "insider" (1-2): Something the industry doesn't want people to know
- "controversial" (1-2): A take that will split the audience — strong viewpoint
- "transformation" (1-2): Specific before/after with a counterintuitive pivot
- "warning" (1-2): Urgency-based — something they're doing wrong right now

EMOTIONAL HOOK VARIETY — each topic should target ONE primary emotion:
envy | fear | curiosity | validation | outrage | hope | guilt | surprise

ANTI-GENERIC FILTER — before outputting any topic, check it passes ALL of these:
✓ Would a real creator with 500K followers post this? (not a brand)
✓ Does it have a specific angle, not a category?
✓ Would it embarrass or surprise most people in the niche?
✓ Is the hook strong enough to work as a TikTok caption alone?
✓ Does it avoid sounding like a blog title or listicle?

PERSONA VARIETY — vary the implied creator voice across topics:
- "practitioner": Someone who actually does the thing (not just talks about it)
- "skeptic": Someone who tried it, was burned, and came back with data
- "insider": Someone with industry knowledge most people don't have access to
- "convert": Someone who believed the mainstream thing and discovered the truth
- "student": Someone who just discovered something and can't believe no one told them
${avoidList}

Return ONLY valid JSON — array of exactly ${count} objects:
[
  {
    "topic":         "specific video angle — must work as a TikTok hook on its own",
    "style":         "Educational | Motivational | Case Study | Documentary | Confession | Controversial",
    "angle":         "stat-first | myth-bust | story-arc | pov | confession | warning | insider | transformation",
    "hookPreview":   "the exact first line a creator would say — max 8 words, conversational, no em-dashes",
    "curiosityType": "confession | documentary | pov | myth-bust | insider | controversial | transformation | warning",
    "emotionalHook": "envy | fear | curiosity | validation | outrage | hope | guilt | surprise",
    "originality":   8
  }
]`;

    const aiResponse = await getAIOrchestrator().generate({
      taskType:       "topic-generate",
      prompt,
      systemPrompt,
      tier:           opts?.tier ?? "advanced",
      jobId:          opts?.jobId,
      skipCache:      true, // always generate fresh topics
      responseFormat: "json",
    });

    const raw  = aiResponse.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) throw new Error("Expected JSON array from AI provider");

    const suggestions = data as TopicSuggestion[];
    const scored      = TopicGeneratorAgent.scoreTopics(suggestions);
    return deduplicate(scored, avoidTopics ?? []);
  }

  // -------------------------------------------------------------------------
  // generateVariations — produce alternative angles on an existing topic
  // -------------------------------------------------------------------------
  async generateVariations(
    existingTopic: string,
    count:         number = 5,
    opts?:         { tier?: "basic" | "advanced"; jobId?: string }
  ): Promise<TopicSuggestion[]> {
    const prompt = `You are a viral content strategist. Take this existing topic and generate ${count} DIFFERENT angles on the same subject — each with a completely different emotional hook, curiosity type, and narrative approach.

ORIGINAL TOPIC: "${existingTopic}"

Generate ${count} variations that are:
- Same general subject area
- Completely different angle, curiosity type, and emotional approach
- Each one independently strong as a TikTok hook
- None of them feel like the original phrased differently

Return ONLY valid JSON array of ${count} objects with the same shape as a TopicSuggestion:
[{ "topic": "...", "style": "...", "angle": "...", "hookPreview": "...", "curiosityType": "...", "emotionalHook": "...", "originality": 7 }]`;

    const aiResponse = await getAIOrchestrator().generate({
      taskType:       "topic-generate",
      prompt,
      tier:           opts?.tier ?? "advanced",
      jobId:          opts?.jobId,
      skipCache:      true,
      responseFormat: "json",
    });

    const raw  = aiResponse.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error("Expected JSON array");

    return TopicGeneratorAgent.scoreTopics(data as TopicSuggestion[]);
  }

  // -------------------------------------------------------------------------
  // scoreTopics — static helper that adjusts originality scores
  // -------------------------------------------------------------------------
  static scoreTopics(suggestions: TopicSuggestion[]): TopicSuggestion[] {
    // Penalize topics that use weak structural patterns
    const weakPatterns = [
      /^(how to|why you|the top|best ways|tips for|\d+ ways|\d+ tips)/i,
      /\b(ultimate|complete|definitive|comprehensive|everything)\b/i,
      /\b(guide|tutorial|overview|introduction)\b/i,
    ];

    return suggestions.map((s) => {
      let score = s.originality ?? 7;

      for (const pattern of weakPatterns) {
        if (pattern.test(s.topic)) {
          score = Math.max(1, score - 3);
          break;
        }
      }

      // Boost topics with specific numbers, names, or timeframes
      if (/\b\d+(%|k|x|s|m|h|d|y)?\b/.test(s.topic)) {
        score = Math.min(10, score + 1);
      }

      return { ...s, originality: score };
    });
  }
}
