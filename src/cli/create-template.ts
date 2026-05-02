#!/usr/bin/env npx tsx
/**
 * TEMPLATE SCAFFOLD — Generate new Remotion video templates
 *
 * Usage:
 *   npx tsx src/cli/create-template.ts --config template-config.json
 *   npx tsx src/cli/create-template.ts --name "unboxing" --scenes 5 --fps 30 --width 1080 --height 1920
 *
 * This generates:
 *   src/remotion/<name>/
 *     types.ts
 *     scenes/S1_<SceneName>.tsx ... S<N>_<SceneName>.tsx
 *     <Name>Video.tsx (main composition)
 *   And auto-registers in Root.tsx
 */

import * as fs from "fs";
import * as path from "path";

// ─── CONFIG TYPES ────────────────────────────────────────────
interface SceneConfig {
  name: string;          // PascalCase scene name, e.g. "TextHook"
  label: string;         // Human label, e.g. "Text Hook"
  durationSec: number;   // Duration in seconds
  style: SceneStyle;     // Visual style preset
  description?: string;  // What happens in this scene
}

type SceneStyle =
  | "text-slam"       // Big text with spring animation
  | "image-reveal"    // Hero image with Ken Burns
  | "image-gallery"   // Crossfade through multiple images
  | "split-compare"   // Before/after or side-by-side
  | "feature-list"    // Icon + text list sliding in
  | "social-proof"    // Number count-up + badges
  | "cta"             // Final CTA with glow
  | "browser-mockup"  // Browser window with content
  | "custom";         // Empty scaffold for manual coding

interface TemplateConfig {
  name: string;          // kebab-case folder name, e.g. "unboxing"
  displayName: string;   // PascalCase, e.g. "Unboxing"
  description: string;
  fps: number;
  width: number;
  height: number;
  scenes: SceneConfig[];
  dataType: "product" | "custom";  // Use existing ProductVideoData or custom
}

// ─── DEFAULTS ────────────────────────────────────────────────
const DEFAULT_SCENES: Record<string, SceneConfig[]> = {
  "unboxing": [
    { name: "TextHook", label: "Text Hook", durationSec: 3, style: "text-slam", description: "Bold question about the product" },
    { name: "PackageReveal", label: "Package Reveal", durationSec: 5, style: "image-reveal", description: "Product packaging beauty shot" },
    { name: "Unboxing", label: "Unboxing", durationSec: 6, style: "image-gallery", description: "Step-by-step unboxing images" },
    { name: "ProductShowcase", label: "Product Showcase", durationSec: 6, style: "image-gallery", description: "Product detail gallery" },
    { name: "Features", label: "Key Features", durationSec: 5, style: "feature-list", description: "Feature highlights with icons" },
    { name: "SocialProof", label: "Social Proof", durationSec: 4, style: "social-proof", description: "Ratings and customer count" },
    { name: "CTA", label: "Call to Action", durationSec: 3.5, style: "cta", description: "Final CTA with product name" },
  ],
  "testimonial": [
    { name: "Hook", label: "Hook", durationSec: 3, style: "text-slam" },
    { name: "ProductIntro", label: "Product Intro", durationSec: 4, style: "image-reveal" },
    { name: "Quote1", label: "Quote 1", durationSec: 5, style: "text-slam" },
    { name: "Quote2", label: "Quote 2", durationSec: 5, style: "text-slam" },
    { name: "Stats", label: "Stats", durationSec: 4, style: "social-proof" },
    { name: "CTA", label: "CTA", durationSec: 3.5, style: "cta" },
  ],
  "comparison": [
    { name: "Hook", label: "Hook", durationSec: 3, style: "text-slam" },
    { name: "ProductA", label: "Product A", durationSec: 5, style: "image-reveal" },
    { name: "ProductB", label: "Product B", durationSec: 5, style: "image-reveal" },
    { name: "Comparison", label: "Side by Side", durationSec: 6, style: "split-compare" },
    { name: "Winner", label: "Winner", durationSec: 4, style: "feature-list" },
    { name: "CTA", label: "CTA", durationSec: 3.5, style: "cta" },
  ],
};

// ─── SCENE CODE GENERATORS ───────────────────────────────────
function generateSceneCode(prefix: string, scene: SceneConfig, index: number): string {
  const componentName = `${prefix}${index + 1}_${scene.name}`;
  const frames = Math.round(scene.durationSec * 30);

  switch (scene.style) {
    case "text-slam":
      return `import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import type { BrandColors } from "../../types";

export const ${componentName}: React.FC<{ text: string; colors: BrandColors }> = ({ text, colors }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 60 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 14px", maxWidth: 900 }}>
        {words.map((word, i) => {
          const delay = i * 3;
          const s = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 200 } });
          const isHighlight = i === 0 || i === words.length - 1;
          return (
            <span key={i} style={{
              fontSize: 72, fontWeight: 800, fontFamily: "'Inter', sans-serif",
              color: isHighlight ? colors.primary : colors.text,
              transform: \`scale(\${s}) translateY(\${(1 - s) * 40}px)\`,
              opacity: s,
              display: "inline-block",
            }}>{word}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
`;

    case "image-reveal":
      return `import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import type { BrandColors } from "../../types";

export const ${componentName}: React.FC<{ imagePath: string; title: string; subtitle?: string; colors: BrandColors }> = ({ imagePath, title, subtitle, colors }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 180 } });
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.08], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, opacity: fadeOut }}>
      {imagePath && (
        <AbsoluteFill style={{ transform: \`scale(\${scale})\`, opacity: s }}>
          <Img src={staticFile(imagePath)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,0.85))" }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 60px 180px" }}>
        <div style={{ transform: \`translateY(\${(1 - s) * 60}px)\`, opacity: s }}>
          <div style={{ fontSize: 56, fontWeight: 800, color: colors.text, fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 24, color: colors.primary, fontWeight: 600 }}>{subtitle}</div>}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
`;

    case "image-gallery":
      return `import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile, useVideoConfig } from "remotion";
import type { BrandColors } from "../../types";

interface GalleryImage { path: string; headline: string; }

export const ${componentName}: React.FC<{ images: GalleryImage[]; colors: BrandColors }> = ({ images, colors }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (!images.length) return <AbsoluteFill style={{ backgroundColor: colors.background }} />;

  const perImage = durationInFrames / Math.max(images.length, 1);
  const activeIndex = Math.min(Math.floor(frame / perImage), images.length - 1);
  const localFrame = frame - activeIndex * perImage;
  const opacity = interpolate(localFrame, [0, 12, perImage - 12, perImage], [0, 1, 1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const scale = interpolate(localFrame, [0, perImage], [1, 1.06], { extrapolateRight: "clamp" });
  const img = images[activeIndex];

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <AbsoluteFill style={{ opacity, transform: \`scale(\${scale})\` }}>
        <Img src={staticFile(img.path)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 50%, rgba(0,0,0,0.8))" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 60px 160px" }}>
        <div style={{ opacity, transform: \`translateY(\${(1 - opacity) * 30}px)\` }}>
          <div style={{ fontSize: 42, fontWeight: 700, color: colors.text, fontFamily: "'Inter', sans-serif" }}>{img.headline}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            {images.map((_, i) => (
              <div key={i} style={{ width: i === activeIndex ? 24 : 8, height: 8, borderRadius: 4, background: i === activeIndex ? colors.primary : "rgba(255,255,255,0.3)", transition: "all 0.3s" }} />
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
`;

    case "feature-list":
      return `import React from "react";
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import type { BrandColors } from "../../types";

interface Feature { icon: string; text: string; }

const ICONS: Record<string, string> = { check: "✓", lightning: "⚡", star: "⭐", shield: "🛡", zap: "⚡", heart: "❤" };

export const ${componentName}: React.FC<{ features: Feature[]; title?: string; colors: BrandColors }> = ({ features, title = "Why You'll Love It", colors }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const titleS = spring({ frame, fps, config: { damping: 14 } });
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, padding: "120px 60px", opacity: fadeOut }}>
      <div style={{ fontSize: 36, fontWeight: 700, color: colors.primary, marginBottom: 40, transform: \`translateY(\${(1 - titleS) * 30}px)\`, opacity: titleS, fontFamily: "'Inter', sans-serif" }}>{title}</div>
      {features.map((f, i) => {
        const s = spring({ frame: frame - 10 - i * 8, fps, config: { damping: 12, stiffness: 180 } });
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 20, marginBottom: 28,
            transform: \`translateX(\${(1 - s) * 80}px)\`, opacity: s,
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: colors.primary + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
              {ICONS[f.icon] || ICONS.check}
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, color: colors.text, fontFamily: "'Inter', sans-serif" }}>{f.text}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
`;

    case "social-proof":
      return `import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import type { BrandColors } from "../../types";

export const ${componentName}: React.FC<{ number: number; label: string; colors: BrandColors }> = ({ number, label, colors }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 30, stiffness: 120 } });
  const count = Math.round(s * number);
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, justifyContent: "center", alignItems: "center", opacity: fadeOut }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 96, fontWeight: 800, color: colors.primary, fontFamily: "'Inter', sans-serif", transform: \`scale(\${0.8 + s * 0.2})\` }}>
          {count.toLocaleString()}+
        </div>
        <div style={{ fontSize: 28, fontWeight: 600, color: colors.text, marginTop: 8, fontFamily: "'Inter', sans-serif", opacity: s }}>{label}</div>
      </div>
    </AbsoluteFill>
  );
};
`;

    case "cta":
      return `import React from "react";
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import type { BrandColors } from "../../types";

export const ${componentName}: React.FC<{ productName: string; ctaText: string; colors: BrandColors }> = ({ productName, ctaText, colors }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s1 = spring({ frame, fps, config: { damping: 12 } });
  const s2 = spring({ frame: frame - 10, fps, config: { damping: 14 } });
  const shine = interpolate(frame, [20, 50], [-100, 400], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 60 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 52, fontWeight: 800, color: colors.text, marginBottom: 24, transform: \`scale(\${s1})\`, fontFamily: "'Inter', sans-serif" }}>
          {productName}
        </div>
        <div style={{
          display: "inline-block", padding: "16px 40px", borderRadius: 50,
          background: colors.primary, fontSize: 26, fontWeight: 700, color: "#fff",
          transform: \`scale(\${s2})\`, overflow: "hidden", position: "relative", fontFamily: "'Inter', sans-serif",
        }}>
          {ctaText}
          <div style={{ position: "absolute", top: 0, left: shine, width: 60, height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)", transform: "skewX(-20deg)" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
`;

    default:
      return `import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { BrandColors } from "../../types";

// TODO: Implement ${scene.name} scene — ${scene.description || scene.label}
export const ${componentName}: React.FC<{ colors: BrandColors }> = ({ colors }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontSize: 36, color: colors.text, fontWeight: 600 }}>${scene.label}</div>
    </AbsoluteFill>
  );
};
`;
  }
}

// ─── TYPES FILE GENERATOR ────────────────────────────────────
function generateTypesFile(config: TemplateConfig): string {
  const prefix = config.displayName.toUpperCase().slice(0, 3);
  const sceneEntries = config.scenes.map((s, i) =>
    `  scene${i + 1}_${s.name.charAt(0).toLowerCase() + s.name.slice(1)}: ${Math.round(s.durationSec * config.fps)},`
  ).join("\n");

  return `/**
 * ${config.displayName.toUpperCase()} VIDEO — Types & Constants
 * ${config.description}
 */
export const ${prefix}_FPS = ${config.fps};
export const ${prefix}_WIDTH = ${config.width};
export const ${prefix}_HEIGHT = ${config.height};

export const ${prefix}_SCENE_FRAMES = {
${sceneEntries}
} as const;

export const ${prefix}_TOTAL_FRAMES = Object.values(${prefix}_SCENE_FRAMES).reduce(
  (a, b) => a + b,
  0
);
`;
}

// ─── MAIN COMPOSITION GENERATOR ──────────────────────────────
function generateMainComposition(config: TemplateConfig): string {
  const prefix = config.displayName.toUpperCase().slice(0, 3);
  const compName = `${config.displayName}Video`;
  const scenePrefix = prefix.charAt(0) + prefix.slice(1).toLowerCase();

  const imports = config.scenes.map((s, i) =>
    `import { ${scenePrefix}${i + 1}_${s.name} } from "./scenes/${scenePrefix}${i + 1}_${s.name}";`
  ).join("\n");

  const sceneKeys = config.scenes.map((s, i) =>
    `scene${i + 1}_${s.name.charAt(0).toLowerCase() + s.name.slice(1)}`
  );

  // Build sequences based on scene styles
  const sequences = config.scenes.map((s, i) => {
    const comp = `${scenePrefix}${i + 1}_${s.name}`;
    const frameKey = sceneKeys[i];
    let props = "";

    switch (s.style) {
      case "text-slam":
        props = `text={data.hook.painPointQuestion} colors={data.brandColors}`;
        break;
      case "image-reveal":
        props = `imagePath={heroImagePath} title={data.productIntro.productName} subtitle={data.productIntro.tagline} colors={data.brandColors}`;
        break;
      case "image-gallery":
        props = `images={data.imageShowcase.images} colors={data.brandColors}`;
        break;
      case "feature-list":
        props = `features={data.featureCallouts.features} colors={data.brandColors}`;
        break;
      case "social-proof":
        props = `number={data.socialProofCta.socialProofNumber} label={data.socialProofCta.socialProofLabel} colors={data.brandColors}`;
        break;
      case "cta":
        props = `productName={data.productIntro.productName} ctaText={data.socialProofCta.ctaUrl} colors={data.brandColors}`;
        break;
      default:
        props = `colors={data.brandColors}`;
    }

    return `      <Sequence from={offset} durationInFrames={${prefix}_SCENE_FRAMES.${frameKey}}>
        <${comp} ${props} />
      </Sequence>
      {(offset += ${prefix}_SCENE_FRAMES.${frameKey}) && null}`;
  }).join("\n\n");

  return `/**
 * ${config.displayName.toUpperCase()} VIDEO — Main Composition
 * ${config.description}
 */
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { z } from "zod";
import { ProductVideoDataSchema } from "../types";
import type { ProductVideoData } from "../types";
import { ${prefix}_SCENE_FRAMES } from "./types";

${imports}

export const ${config.name.replace(/-/g, "")}Schema = z.object({
  data: ProductVideoDataSchema.nullable(),
});

export const ${compName}: React.FC<z.infer<typeof ${config.name.replace(/-/g, "")}Schema>> = ({ data }) => {
  if (!data) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "#fff", fontSize: 48, fontWeight: "bold" }}>Loading...</div>
      </AbsoluteFill>
    );
  }

  const heroImagePath = data.imageShowcase.images.length > 0
    ? data.imageShowcase.images[0].path
    : data.featureCallouts.productImagePath;

  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: data.brandColors.background }}>
${sequences}
    </AbsoluteFill>
  );
};
`;
}

// ─── ROOT.TSX UPDATER ────────────────────────────────────────
function updateRootTsx(config: TemplateConfig, rootPath: string): void {
  const prefix = config.displayName.toUpperCase().slice(0, 3);
  const compName = `${config.displayName}Video`;
  const schemaName = `${config.name.replace(/-/g, "")}Schema`;

  let root = fs.readFileSync(rootPath, "utf-8");

  // Add import if not already present
  const importLine = `import { ${compName}, ${schemaName} } from "./${config.name}/${compName}";`;
  const typesImport = `import { ${prefix}_FPS, ${prefix}_WIDTH, ${prefix}_HEIGHT, ${prefix}_TOTAL_FRAMES } from "./${config.name}/types";`;

  if (!root.includes(compName)) {
    // Insert imports after last import line
    const importLines = root.split("\n").filter(l => l.startsWith("import "));
    const lastImport = importLines[importLines.length - 1];
    root = root.replace(lastImport, `${lastImport}\n${importLine}\n${typesImport}`);

    // Insert composition before the closing fragment
    const compositionBlock = `
      {/* ${config.displayName} template */}
      <Composition
        id="${config.name}"
        component={${compName}}
        fps={${prefix}_FPS}
        width={${prefix}_WIDTH}
        height={${prefix}_HEIGHT}
        durationInFrames={${prefix}_TOTAL_FRAMES}
        schema={${schemaName}}
        defaultProps={{ data: null }}
      />
`;
    root = root.replace("    </>", `${compositionBlock}    </>`);

    fs.writeFileSync(rootPath, root);
    console.log(`[scaffold] Updated Root.tsx with "${config.name}" composition`);
  } else {
    console.log(`[scaffold] Root.tsx already has "${config.name}" — skipping`);
  }
}

// ─── MAIN ────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);

  let config: TemplateConfig;

  // Check for --config flag
  const configIdx = args.indexOf("--config");
  if (configIdx !== -1 && args[configIdx + 1]) {
    const raw = fs.readFileSync(args[configIdx + 1], "utf-8");
    config = JSON.parse(raw);
  } else {
    // Build from CLI args
    const nameIdx = args.indexOf("--name");
    const name = nameIdx !== -1 ? args[nameIdx + 1] : "new-template";

    const presetIdx = args.indexOf("--preset");
    const preset = presetIdx !== -1 ? args[presetIdx + 1] : undefined;

    const fpsIdx = args.indexOf("--fps");
    const fps = fpsIdx !== -1 ? Number(args[fpsIdx + 1]) : 30;

    const widthIdx = args.indexOf("--width");
    const width = widthIdx !== -1 ? Number(args[widthIdx + 1]) : 1080;

    const heightIdx = args.indexOf("--height");
    const height = heightIdx !== -1 ? Number(args[heightIdx + 1]) : 1920;

    const displayName = name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");

    config = {
      name,
      displayName,
      description: `${displayName} video template`,
      fps, width, height,
      scenes: preset && DEFAULT_SCENES[preset] ? DEFAULT_SCENES[preset] : DEFAULT_SCENES["unboxing"],
      dataType: "product",
    };
  }

  const baseDir = path.resolve("src/remotion", config.name);
  const scenesDir = path.join(baseDir, "scenes");
  const prefix = config.displayName.toUpperCase().slice(0, 3);
  const scenePrefix = prefix.charAt(0) + prefix.slice(1).toLowerCase();

  console.log(`\n[scaffold] Creating template: ${config.name}`);
  console.log(`[scaffold] Scenes: ${config.scenes.length}`);
  console.log(`[scaffold] Output: ${baseDir}\n`);

  // Create directories
  fs.mkdirSync(scenesDir, { recursive: true });

  // Generate types
  fs.writeFileSync(path.join(baseDir, "types.ts"), generateTypesFile(config));
  console.log(`[scaffold] Created types.ts`);

  // Generate scenes
  for (let i = 0; i < config.scenes.length; i++) {
    const scene = config.scenes[i];
    const fileName = `${scenePrefix}${i + 1}_${scene.name}.tsx`;
    const code = generateSceneCode(scenePrefix, scene, i);
    fs.writeFileSync(path.join(scenesDir, fileName), code);
    console.log(`[scaffold] Created scenes/${fileName} (${scene.style})`);
  }

  // Generate main composition
  const compName = `${config.displayName}Video`;
  fs.writeFileSync(path.join(baseDir, `${compName}.tsx`), generateMainComposition(config));
  console.log(`[scaffold] Created ${compName}.tsx`);

  // Update Root.tsx
  const rootPath = path.resolve("src/remotion/Root.tsx");
  if (fs.existsSync(rootPath)) {
    updateRootTsx(config, rootPath);
  } else {
    console.log(`[scaffold] Warning: Root.tsx not found at ${rootPath}`);
  }

  // Generate config file for reference
  fs.writeFileSync(path.join(baseDir, "template.json"), JSON.stringify(config, null, 2));
  console.log(`[scaffold] Saved template.json`);

  const totalSec = config.scenes.reduce((a, s) => a + s.durationSec, 0);
  console.log(`\n[scaffold] Done! ${config.scenes.length} scenes, ${totalSec}s total`);
  console.log(`[scaffold] Render: npx remotion render src/remotion/index.ts ${config.name} output.mp4`);
  console.log(`[scaffold] Studio: npx remotion studio src/remotion/index.ts\n`);
}

main();
