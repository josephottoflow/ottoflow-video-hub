/**
 * APPROVAL AGENT — Telegram Bot for Video Review
 * Sends rendered video thumbnail + SEO preview to Telegram.
 * Inline keyboard: [✅ Approve] [❌ Reject]
 * Polls for callback response. Pipeline waits for decision.
 *
 * Setup: Message @BotFather on Telegram → /newbot → get token.
 * Then message your bot, and get your chat_id from:
 * https://api.telegram.org/bot<TOKEN>/getUpdates
 */

import * as fs from "fs";
import * as path from "path";
import { getConfig } from "../config/config";
import type { SeoOutput } from "../seo/seo-generator";

// === Types ===

export type ApprovalDecision = "approved" | "rejected" | "timeout";

export interface ApprovalRequest {
  productSlug: string;
  productName: string;
  thumbnailPath?: string;
  videoPath?: string;
  seo: SeoOutput;
  imageCount: number;
}

export interface ApprovalResult {
  decision: ApprovalDecision;
  decidedAt: string;
  waitTimeMs: number;
}

// === Telegram API Base ===

const TELEGRAM_API = "https://api.telegram.org/bot";

// === Approval Bot ===

export class TelegramApprovalBot {
  private config = getConfig();
  private botToken: string;
  private chatId: string;
  private timeoutMs: number;

  constructor() {
    this.botToken = this.config.telegram.botToken;
    this.chatId = this.config.telegram.chatId;
    this.timeoutMs = this.config.telegram.approvalTimeoutMs;
  }

  /**
   * Send a video for review and wait for approval/rejection.
   * Returns the decision once the user taps a button.
   */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    const startTime = Date.now();

    // Build the preview message
    const message = this.buildPreviewMessage(request);

    // Send thumbnail if available, otherwise send text
    let messageId: number;

    if (request.thumbnailPath && fs.existsSync(request.thumbnailPath)) {
      messageId = await this.sendPhotoWithButtons(
        request.thumbnailPath,
        message,
        request.productSlug
      );
    } else {
      messageId = await this.sendTextWithButtons(
        message,
        request.productSlug
      );
    }

    console.log(
      `[telegram] Sent approval request for "${request.productName}" — waiting for response...`
    );

    // Poll for callback response
    const decision = await this.pollForDecision(
      request.productSlug,
      messageId
    );

    const waitTimeMs = Date.now() - startTime;

    // Send confirmation message
    if (decision === "approved") {
      await this.sendText(`✅ *${request.productName}* approved! Exporting...`);
    } else if (decision === "rejected") {
      await this.sendText(
        `❌ *${request.productName}* rejected. Marking for re-review.`
      );
    } else {
      await this.sendText(
        `⏰ *${request.productName}* timed out after ${Math.round(this.timeoutMs / 60000)}min. Auto-skipping.`
      );
    }

    return {
      decision,
      decidedAt: new Date().toISOString(),
      waitTimeMs,
    };
  }

  /**
   * Send the final rendered video file to Telegram.
   * Includes caption with hooks and hashtags ready to copy-paste.
   * Falls back to sendDocument if video upload fails (>50MB).
   */
  async deliverVideo(
    videoPath: string,
    topic: string,
    hooks: { a: string; b: string; c: string },
    hashtags: string[],
    slug?: string
  ): Promise<void> {
    const caption  = this.buildDeliveryCaption(topic, hooks, hashtags);
    const fullSlug = slug || topic.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const cbSlug   = fullSlug.slice(0, 55);
    const markup   = {
      inline_keyboard: [[
        { text: "✅ Approve", callback_data: `approve:${cbSlug}` },
        { text: "❌ Reject",  callback_data: `reject:${cbSlug}`  },
      ]],
    };

    try {
      await this.sendVideoFile(videoPath, caption, markup);
    } catch (err) {
      console.warn("[telegram] sendVideo failed, trying sendDocument:", err);
      await this.sendDocumentFile(videoPath, caption);
    }
  }

  /**
   * V2: Send the rendered video with ✅ Approve / ❌ Reject / 🔄 Retry buttons.
   * Polls for callback. Returns the decision.
   */
  async sendVideoForApproval(
    videoPath: string,
    topic:     string,
    jobSlug:   string
  ): Promise<ApprovalResult> {
    const startTime = Date.now();

    // Step 1: Upload the video without any buttons (avoids BUTTON_DATA_INVALID on FormData)
    const formData = new FormData();
    const buffer   = fs.readFileSync(videoPath);
    const blob     = new Blob([buffer], { type: "video/mp4" });
    const caption  = `🎬 *V2 REVIEW*\n\n📹 ${this.escapeMarkdown(topic)}`;

    formData.append("chat_id",    this.chatId);
    formData.append("video",      blob, "video.mp4");
    formData.append("caption",    caption);
    formData.append("parse_mode", "Markdown");
    formData.append("supports_streaming", "true");

    const videoRes  = await fetch(`${TELEGRAM_API}${this.botToken}/sendVideo`, { method: "POST", body: formData });
    const videoData = await videoRes.json() as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!videoData.ok) throw new Error(`sendVideo failed: ${videoData.description}`);
    console.log(`[telegram] V2 video sent for "${topic}" (msg ${videoData.result!.message_id})`);

    // Step 2: Send approval buttons in a separate text message (no file upload = no FormData issues)
    const cbSlug = jobSlug.slice(0, 55);
    const buttonMsgId = await this.sendTextWithButtons(
      `👇 *Approve or reject:*\n\n_${this.escapeMarkdown(topic)}_`,
      cbSlug
    );
    console.log(`[telegram] Approval buttons sent (msg ${buttonMsgId})`);

    const decision   = await this.pollForDecision(cbSlug, buttonMsgId);
    const waitTimeMs = Date.now() - startTime;

    const statusMsg = decision === "approved"
      ? `✅ *${this.escapeMarkdown(topic)}* approved\\! Saving to library\\.`
      : decision === "rejected"
      ? `❌ *${this.escapeMarkdown(topic)}* rejected\\.`
      : `⏰ *${this.escapeMarkdown(topic)}* timed out \\(${Math.round(this.timeoutMs / 60000)}min\\)\\.`;

    await this.sendText(statusMsg);

    return { decision, decidedAt: new Date().toISOString(), waitTimeMs };
  }

  /**
   * Send a simple notification (no approval needed).
   */
  async notify(text: string): Promise<void> {
    await this.sendText(text);
  }

  // === Message Builder ===

  private buildPreviewMessage(request: ApprovalRequest): string {
    const lines = [
      `🎬 *VIDEO READY FOR REVIEW*`,
      ``,
      `📦 *Product:* ${this.escapeMarkdown(request.productName)}`,
      `🖼️ *Images:* ${request.imageCount}`,
      ``,
      `📝 *SEO Title:*`,
      this.escapeMarkdown(request.seo.title),
      ``,
      `🪝 *Hook:*`,
      this.escapeMarkdown(request.seo.hook),
      ``,
      `📋 *Description:*`,
      this.escapeMarkdown(request.seo.description.slice(0, 300) + (request.seo.description.length > 300 ? "..." : "")),
      ``,
      `🏷️ *Hashtags:*`,
      request.seo.hashtags.slice(0, 10).map((h) => `#${h}`).join(" "),
      ``,
      `👇 *Tap to approve or reject:*`,
    ];

    return lines.join("\n");
  }

  // === Telegram API Methods ===

  private async sendText(text: string): Promise<number> {
    const res = await fetch(`${TELEGRAM_API}${this.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    const data = await res.json();
    if (!data.ok) throw new Error(`Telegram sendMessage failed: ${data.description}`);
    return data.result.message_id;
  }

  private async sendTextWithButtons(
    text: string,
    productSlug: string
  ): Promise<number> {
    const res = await fetch(`${TELEGRAM_API}${this.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Approve",
                callback_data: `approve:${productSlug}`,
              },
              {
                text: "❌ Reject",
                callback_data: `reject:${productSlug}`,
              },
            ],
          ],
        },
      }),
    });

    const data = await res.json();
    if (!data.ok) throw new Error(`Telegram sendMessage failed: ${data.description}`);
    return data.result.message_id;
  }

  private async sendPhotoWithButtons(
    photoPath: string,
    caption: string,
    productSlug: string
  ): Promise<number> {
    const formData = new FormData();
    const photoBuffer = fs.readFileSync(photoPath);
    const photoBlob = new Blob([photoBuffer], { type: "image/png" });

    formData.append("chat_id", this.chatId);
    formData.append("photo", photoBlob, "thumbnail.png");
    // Telegram caption limit is 1024 chars
    formData.append(
      "caption",
      caption.length > 1024 ? caption.slice(0, 1020) + "..." : caption
    );
    formData.append("parse_mode", "Markdown");
    formData.append(
      "reply_markup",
      JSON.stringify({
        inline_keyboard: [
          [
            {
              text: "✅ Approve",
              callback_data: `approve:${productSlug}`,
            },
            {
              text: "❌ Reject",
              callback_data: `reject:${productSlug}`,
            },
          ],
        ],
      })
    );

    const res = await fetch(`${TELEGRAM_API}${this.botToken}/sendPhoto`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!data.ok) throw new Error(`Telegram sendPhoto failed: ${data.description}`);
    return data.result.message_id;
  }

  // === Poll for Callback ===

  private async pollForDecision(
    productSlug: string,
    _messageId: number
  ): Promise<ApprovalDecision> {
    const startTime = Date.now();
    let lastUpdateId = 0;
    let consecutiveErrors = 0;

    while (Date.now() - startTime < this.timeoutMs) {
      try {
        const url = new URL(`${TELEGRAM_API}${this.botToken}/getUpdates`);
        url.searchParams.set("offset", String(lastUpdateId + 1));
        url.searchParams.set("timeout", "5");
        url.searchParams.set("allowed_updates", '["callback_query"]');

        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) {
          console.warn(`[telegram] getUpdates HTTP ${res.status} — retrying`);
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        const data = await res.json();
        consecutiveErrors = 0;

        if (!data.ok) {
          console.warn(`[telegram] getUpdates not ok: ${data.description}`);
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }

        for (const update of data.result || []) {
          lastUpdateId = update.update_id;

          const callback = update.callback_query;
          if (!callback?.data) continue;

          const [action, slug] = callback.data.split(":");

          if (slug === productSlug) {
            const isApprove = action === "approve";
            const isRetry   = action === "retry";

            await this.answerCallback(
              callback.id,
              isApprove ? "✅ Approved!" : isRetry ? "🔄 Queued for retry" : "❌ Rejected!"
            ).catch((e) => console.warn("[telegram] answerCallback failed:", e));

            await this.editMessageButtons(
              callback.message.message_id,
              isApprove ? "✅ APPROVED" : isRetry ? "🔄 RETRY REQUESTED" : "❌ REJECTED"
            ).catch((e) => console.warn("[telegram] editMessageButtons failed:", e));

            return isApprove ? "approved" : "rejected";
          }
        }
      } catch (err) {
        consecutiveErrors++;
        const backoffMs = Math.min(2000 * Math.pow(2, consecutiveErrors - 1), 30_000);
        console.warn(
          `[telegram] Poll error #${consecutiveErrors}: ${err instanceof Error ? err.message : err} — retrying in ${backoffMs}ms`
        );
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    return "timeout";
  }

  private async answerCallback(
    callbackQueryId: string,
    text: string
  ): Promise<void> {
    const res  = await fetch(`${TELEGRAM_API}${this.botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (!data.ok) throw new Error(`answerCallbackQuery failed: ${data.description}`);
  }

  private async editMessageButtons(
    messageId: number,
    statusText: string
  ): Promise<void> {
    const res  = await fetch(`${TELEGRAM_API}${this.botToken}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:      this.chatId,
        message_id:   messageId,
        reply_markup: { inline_keyboard: [[{ text: statusText, callback_data: "noop" }]] },
      }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (!data.ok) throw new Error(`editMessageReplyMarkup failed: ${data.description}`);
  }

  // === Video Delivery ===

  private async sendVideoFile(videoPath: string, caption: string, replyMarkup?: object): Promise<void> {
    const formData = new FormData();
    const buffer   = fs.readFileSync(videoPath);
    const blob     = new Blob([buffer], { type: "video/mp4" });

    formData.append("chat_id",    this.chatId);
    formData.append("video",      blob, path.basename(videoPath));
    formData.append("caption",    caption.length > 1024 ? caption.slice(0, 1020) + "..." : caption);
    formData.append("parse_mode", "MarkdownV2");
    formData.append("supports_streaming", "true");
    if (replyMarkup) formData.append("reply_markup", JSON.stringify(replyMarkup));

    const res  = await fetch(`${TELEGRAM_API}${this.botToken}/sendVideo`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (!data.ok) throw new Error(`sendVideo failed: ${data.description}`);
  }

  private async sendDocumentFile(videoPath: string, caption: string): Promise<void> {
    const formData = new FormData();
    const buffer   = fs.readFileSync(videoPath);
    const blob     = new Blob([buffer], { type: "video/mp4" });

    formData.append("chat_id",    this.chatId);
    formData.append("document",   blob, path.basename(videoPath));
    formData.append("caption",    caption.length > 1024 ? caption.slice(0, 1020) + "..." : caption);
    formData.append("parse_mode", "MarkdownV2");

    const res  = await fetch(`${TELEGRAM_API}${this.botToken}/sendDocument`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (!data.ok) throw new Error(`sendDocument failed: ${data.description}`);
  }

  private buildDeliveryCaption(
    topic: string,
    hooks: { a: string; b: string; c: string },
    hashtags: string[]
  ): string {
    const esc  = (t: string) => t.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
    const tags = hashtags.slice(0, 15).join(" ");

    const lines = [
      `🎬 *${esc(topic)}*`,
      ``,
      hooks.a ? `🪝 Hook A: ${esc(hooks.a)}` : null,
      hooks.b ? `🪝 Hook B: ${esc(hooks.b)}` : null,
      hooks.c ? `🪝 Hook C: ${esc(hooks.c)}` : null,
      ``,
      tags ? `🏷️ ${esc(tags)}` : null,
    ].filter(Boolean);

    return lines.join("\n");
  }

  // === Helpers ===

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
  }
}
