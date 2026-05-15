# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Project name:** Ottoflow Video Hub

## Commands

```bash
# Next.js dashboard (port 3000)
npm run dev

# Remotion Studio visual preview (port 3001)
npm run studio

# Render a specific composition to file
npm run render -- <CompositionId> output/video.mp4

# Render cinematic template with production settings
npm run render:cinematic

# Full Google Sheets pipeline (requires .env)
npm run pipeline

# Validate environment variables
npm run validate-env

# One-shot batch: process all folders in input/ → outputs/
npx tsx src/cli/process-videos.ts
npx tsx src/cli/process-videos.ts --input ./my-photos --output ./my-videos

# Live folder watcher (polls every 3s, auto-renders on new images)
npx tsx src/cli/watch-videos.ts
```

**Important:** All render commands must be run from the project root. Remotion resolves `public/` relative to `cwd`.

## Architecture

### Two entry points

**1. Google Sheets pipeline** (`npm run pipeline`)
`src/cli/run-pipeline.ts` → `PipelineOrchestrator` reads pending rows from Google Sheets → for each product: copy images to `public/content/<slug>/images/`, build `ProductVideoData`, render via Remotion CLI, send to Telegram for approval, export final video + metadata to `outputs/<slug>/`.

**2. Folder-drop pipeline** (`process-videos.ts` / `watch-videos.ts`)
Drop a folder of images into `input/<product-name>/` → `auto-pipeline/data-builder.ts` scans images + reads optional `config.json`, fetches Pexels stock backgrounds, builds `ProductVideoData`, writes `public/content/<slug>/video-data.json`, then `watcher.ts` calls `npx remotion render` via `execSync` for each template.

### Agent layer (`src/agents/`)

| Agent | Purpose |
|---|---|
| `config/config.ts` | Singleton env loader — all API keys flow through here; call `getConfig()` |
| `pipeline/orchestrator.ts` | Sheets-driven master controller |
| `auto-pipeline/` | Folder-drop pipeline: `data-builder.ts` builds `ProductVideoData`, `watcher.ts` polls and renders |
| `render/render-agent.ts` | Wraps `npx remotion render` via `execSync` |
| `approval/telegram-bot.ts` | Blocks pipeline until Telegram approve/reject (5 min timeout) |
| `sheets/client.ts` | Google Sheets status tracking |
| `pexels/` | Fetches stock background photos/videos for scenes |
| `image-cleaner/` | Scores + filters product images before render |
| `image-upscaler/` | Sharp-based upscale + smart resize to 1080px |
| `creative-review/` | AI-powered creative quality check |
| `seo/seo-generator.ts` | Generates TikTok caption + hashtags |
| `prompt-engine/product-prompts.ts` | Builds `ProductVideoData` from raw product info |

### Remotion video layer (`src/remotion/`)

`Root.tsx` registers all compositions. It dynamically discovers products by scanning `public/content/*/video-data.json` via `getStaticFiles()` and registers a composition per product. Props are loaded at render time from `/api/video-data/[slug]` (Next.js) or the static file directly.

**Six registered templates:**

| ID | File | Duration | Notes |
|---|---|---|---|
| `product-video` | `ProductVideo.tsx` | 25s (750 frames) | 6 scenes: Hook → ProductIntro → SimulatedDemo → ImageShowcase → FeatureCallouts → SocialProofCta |
| `product-demo` | `product-demo/ProductDemoVideo.tsx` | varies | 7-scene pipeline default |
| `unboxing` | `unboxing/UnboxingVideo.tsx` | varies | Reveal template |
| `before-after` | `before-after/BeforeAfterVideo.tsx` | varies | Side-by-side comparison |
| `cinematic` | `cinematic/CinematicVideo.tsx` | 28s (840 frames) | Apple-style; accepts `CinematicVideoProps` or legacy `ProductVideoData` (auto-converted) |
| `demo-video` | `demo/DemoVideo.tsx` | varies | Standalone demo, no product data |

**Smart animation engine** (`src/remotion/engine/`): classifies images by category (`hero`/`detail`/`lifestyle`/`angle`), assigns them to scenes, drives camera movement, lighting, and transitions — shared by the `cinematic` template.

**Port allocation:** Next.js = 3000, Remotion Studio = 3001, Remotion render CLI = 3100.

### Core data type

`ProductVideoData` (`src/remotion/types.ts`) is the Zod-validated schema passed as props to all Remotion compositions. It carries `brandColors`, per-scene data (`hook`, `productIntro`, `simulatedDemo`, `imageShowcase`, `featureCallouts`, `socialProofCta`), and optional `backgrounds` (Pexels paths). Image paths inside it are always relative to `public/` (e.g. `content/<slug>/images/frame-01.png`).

### Next.js dashboard (`src/app/`)

App Router dashboard for managing products. Key API routes under `src/app/api/`:
- `products/` — list products from `public/content/`
- `video-data/[slug]/` — serve `video-data.json` to Remotion at render time
- `process/` — trigger `processBatch` on `input/`
- `pipeline/` — trigger `PipelineOrchestrator`
- `render/` — queue a render job
- `pexels/` — proxy Pexels background fetch

### Environment variables

**Required for Sheets pipeline:**
```
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY        # newlines as \n in .env
GOOGLE_SPREADSHEET_ID
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

**Optional:**
```
ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID   # TTS narration
OLLAMA_URL / OLLAMA_MODEL                  # local LLM for prompt engine + SEO
TIKTOK_USER_AGENT                          # enables TikTok Puppeteer scraper
PEXELS_API_KEY                             # stock background fetch
OUTPUT_DIR / TEMP_DIR / VIDEO_WIDTH / VIDEO_HEIGHT / VIDEO_FPS
```

Run `npm run validate-env` to check required keys before running the pipeline.

### Adding a new video template

1. Create `src/remotion/<name>/` with a root component, Zod schema, and `types.ts` (fps/width/height/total frames constants).
2. Register the `<Composition>` in `src/remotion/Root.tsx`.
3. Add the template ID string to `ALL_TEMPLATES` in `src/agents/auto-pipeline/data-builder.ts` so folder-drop auto-selects it.
