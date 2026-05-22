import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, ProviderResult } from "../types";

export class ClaudeProvider implements AIProvider {
  readonly name = "claude" as const;
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    this.client = new Anthropic({ apiKey });
  }

  async generate(
    model: string,
    systemPrompt: string | undefined,
    userPrompt: string,
    opts: { maxTokens: number; temperature: number; json: boolean }
  ): Promise<ProviderResult> {
    const response = await this.client.messages.create({
      model,
      max_tokens:  opts.maxTokens,
      temperature: opts.temperature,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return {
      text,
      inputTokens:  response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
