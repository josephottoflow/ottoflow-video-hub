/**
 * BARREL EXPORT — All Agents
 * Single import point for the entire agent system.
 */

// Config
export { getConfig, validateConfig, resetConfig, ConfigError } from "./config/config";
export type { AppConfig } from "./config/config";

// Sheets
export { SheetsClient } from "./sheets/client";
export type { ContentRow, ContentStatus, PlatformStatus, ProductRow } from "./sheets/client";

// Scraper
export { TikTokScraper } from "./scraper/tiktok-scraper";
export type { ScrapedProduct, ScrapeResult } from "./scraper/tiktok-scraper";

// Ingestion
export { ImageProcessor } from "./ingestion/image-processor";
export type { ImageManifest, ProcessedImage } from "./ingestion/image-processor";

// Prompt Engine
export { PromptEngine } from "./prompt-engine/product-prompts";
export type { ProductVideoData } from "./prompt-engine/product-prompts";

// SEO
export { SeoGenerator } from "./seo/seo-generator";
export type { SeoOutput } from "./seo/seo-generator";

// Render
export { RenderAgent } from "./render/render-agent";
export type { RenderResult } from "./render/render-agent";

// Approval
export { TelegramApprovalBot } from "./approval/telegram-bot";
export type { ApprovalDecision, ApprovalResult } from "./approval/telegram-bot";

// Export
export { Exporter } from "./export/exporter";
export type { ExportResult, ExportMetadata, ExportOptions } from "./export/exporter";

// Image Cleaner
export { cleanImages, cleanAndCopy } from "./image-cleaner/image-cleaner";
export type { ImageScore, CleaningResult } from "./image-cleaner/image-cleaner";

// Creative Director Review Agent
export { creativeReview, quickCheck, logReview } from "./creative-review/creative-review-agent";
export type { CreativeReviewResult } from "./creative-review/creative-review-agent";

// Image Upscaler + Smart Resize
export { processImage, upscaleImages, smartPrepare } from "./image-upscaler/image-upscaler";

// Review Agent
export { reviewFrames, preRenderCheck } from "./review/review-agent";

// Design Agent
export { DesignAgent } from "./design/design-agent";
export type { DesignSpec, ThemePreset, OverlayStyle, FontWeight, TextEffect, Mood, DesignAgentTask } from "./design/design-agent";

// Storyboard Agent (V2 Dynamic Engine)
export { StoryboardAgent } from "./storyboard/storyboard-agent";
export type { Storyboard, StoryboardScene, VisualStyle, CaptionStyle, MusicMood, SceneBeat } from "./storyboard/storyboard-agent";

// FFmpeg Post-Processor
export { FFmpegAgent } from "./ffmpeg/ffmpeg-agent";
export type { FFmpegResult } from "./ffmpeg/ffmpeg-agent";

// Remotion Agent
export { RemotionAgent, COMPOSITIONS } from "./remotion/remotion-agent";
export type { RemotionTask, CompositionInfo, CompositionId, RenderOptions } from "./remotion/remotion-agent";

// Script Writer Agent
export { ScriptWriterAgent } from "./scriptwriter/scriptwriter-agent";
export type { GeneratedScript, ScriptTask } from "./scriptwriter/scriptwriter-agent";
export type { HookStyle } from "./scriptwriter/scriptwriter-agent";

// n8n Agent
export { N8nAgent } from "./n8n/n8n-agent";
export type { N8nWorkflow, N8nNode, N8nExecution, CreateWorkflowPayload } from "./n8n/n8n-agent";

// Pipeline
export { PipelineOrchestrator } from "./pipeline/orchestrator";
export type { PipelineResult } from "./pipeline/orchestrator";
