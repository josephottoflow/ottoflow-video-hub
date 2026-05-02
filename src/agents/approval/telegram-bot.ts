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

    while (Date.now() - startTime < this.timeoutMs) {
      try {
        const url = new URL(
          `${TELEGRAM_API}${this.botToken}/getUpdates`
        );
        url.searchParams.set("offset", String(lastUpdateId + 1));
        url.searchParams.set("timeout", "5"); // long-poll 5 seconds
        url.searchParams.set("allowed_updates", '["callback_query"]');

        const res = await fetch(url.toString());
        const data = await res.json();

        if (!data.ok) continue;

        for (const update of data.result || []) {
          lastUpdateId = update.update_id;

          const callback = update.callback_query;
          if (!callback?.data) continue;

          const [action, slug] = callback.data.split(":");

          if (slug === productSlug) {
            // Answer the callback to remove the loading state
            await this.answerCallback(
              callback.id,
              action === "approve" ? "✅ Approved!" : "❌ Rejected!"
            );

            // Update the message to show the decision
            await this.editMessageButtons(
              callback.message.message_id,
              action === "approve"
                ? "✅ APPROVED"
                : "❌ REJECTED"
            );

            return action === "approve" ? "approved" : "rejected";
          }
        }
      } catch {
        // Network error — wait a bit and retry
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    return "timeout";
  }

  private async answerCallback(
    callbackQueryId: string,
    text: string
  ): Promise<void> {
    await fetch(
      `${TELEGRAM_API}${this.botToken}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
        }),
      }
    );
  }

  private async editMessageButtons(
    messageId: number,
    statusText: string
  ): Promise<void> {
    await fetch(
      `${TELEGRAM_API}${this.botToken}/editMessageReplyMarkup`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: statusText, callback_data: "noop" }],
            ],
          },
        }),
      }
    );
  }

  // === Helpers ===

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
  }
}
