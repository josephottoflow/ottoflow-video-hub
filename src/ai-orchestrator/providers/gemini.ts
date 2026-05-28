import { GoogleGenAI } from "@google/genai";
import type { AIProvider, ProviderResult } from "../types";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY is not set");
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(
    model: string,
    systemPrompt: string | undefined,
    userPrompt: string,
    opts: { maxTokens: number; temperature: number; json: boolean }
  ): Promise<ProviderResult> {
    const response = await this.ai.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        maxOutputTokens: opts.maxTokens,
        temperature:     opts.temperature,
        // Disable thinking mode — gemini-2.5-flash uses internal reasoning tokens
        // by default, consuming most of maxOutputTokens and leaving only ~90 tokens
        // for actual visible output (causing JSON truncation).
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    // Join all text parts — response.text only returns the first part in some SDK versions
    const rawText = response.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string }) => p.text)
      .map((p: { text?: string }) => p.text!)
      .join("") ?? response.text ?? "";

    const text = rawText.trim();

    // usageMetadata may be undefined on some Gemini models — fall back to char-based estimate
    const inputTokens  = response.usageMetadata?.promptTokenCount     ?? Math.ceil((userPrompt + (systemPrompt ?? "")).length / 4);
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? Math.ceil(text.length / 4);

    return { text, inputTokens, outputTokens };
  }
}
