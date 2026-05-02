/**
 * SCRAPER AGENT — TikTok Product Photo Extractor
 * Mobile-emulated Puppeteer scraper that bypasses TikTok's
 * desktop restrictions by pretending to be an iPhone.
 * Extracts product images from TikTok affiliate/shop links.
 */

import puppeteer, { Browser, Page } from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import { getConfig } from "../config/config";

// === Types ===

export interface ScrapedProduct {
  productName: string;
  images: string[]; // local file paths to downloaded images
  sourceUrl: string;
  scrapedAt: string;
}

export interface ScrapeResult {
  success: boolean;
  product?: ScrapedProduct;
  error?: string;
}

// === Scraper ===

export class TikTokScraper {
  private config = getConfig();

  /**
   * Scrape product images from a TikTok link.
   * Uses mobile emulation to bypass desktop restrictions.
   */
  async scrape(
    tiktokUrl: string,
    outputDir: string,
    productSlug: string
  ): Promise<ScrapeResult> {
    let browser: Browser | null = null;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });

      const page = await browser.newPage();
      await this.setupMobileEmulation(page);

      // Navigate with retry logic
      const loaded = await this.navigateWithRetry(page, tiktokUrl);
      if (!loaded) {
        return { success: false, error: "Failed to load page after retries" };
      }

      // Wait for product content to render
      await this.waitForProductContent(page);

      // Extract product name
      const productName = await this.extractProductName(page);

      // Extract image URLs from the page
      const imageUrls = await this.extractProductImages(page);

      if (imageUrls.length === 0) {
        return { success: false, error: "No product images found on page" };
      }

      // Download images to local directory
      const imagesDir = path.join(outputDir, productSlug, "images");
      fs.mkdirSync(imagesDir, { recursive: true });

      const downloadedPaths = await this.downloadImages(
        page,
        imageUrls,
        imagesDir
      );

      return {
        success: true,
        product: {
          productName: productName || productSlug,
          images: downloadedPaths,
          sourceUrl: tiktokUrl,
          scrapedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown scraper error";
      return { success: false, error: message };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // === Mobile Emulation ===

  private async setupMobileEmulation(page: Page): Promise<void> {
    const tiktokConfig = this.config.tiktok ?? {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
      maxRetries: 3,
    };
    const { userAgent, viewport } = tiktokConfig;

    await page.setUserAgent(userAgent);
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });

    // Set mobile-specific headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    });
  }

  // === Navigation with Retry ===

  private async navigateWithRetry(
    page: Page,
    url: string
  ): Promise<boolean> {
    const maxRetries = this.config.tiktok?.maxRetries ?? 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        return true;
      } catch {
        if (attempt < maxRetries - 1) {
          // Wait before retry with exponential backoff
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    }

    return false;
  }

  // === Wait for Product Content ===

  private async waitForProductContent(page: Page): Promise<void> {
    // Try multiple selectors that TikTok Shop uses
    const selectors = [
      'img[src*="tiktokcdn"]',
      'img[src*="alicdn"]',
      ".product-image",
      '[data-e2e="product-image"]',
      ".swiper-slide img",
      "img.product",
      ".image-gallery img",
    ];

    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        return;
      } catch {
        // Try next selector
      }
    }

    // Fallback: just wait for any images
    await page.waitForSelector("img", { timeout: 10000 });
  }

  // === Extract Product Name ===

  private async extractProductName(page: Page): Promise<string> {
    const selectors = [
      "h1",
      '[data-e2e="product-title"]',
      ".product-title",
      ".product-name",
      'meta[property="og:title"]',
    ];

    for (const selector of selectors) {
      try {
        if (selector.startsWith("meta")) {
          const content = await page.$eval(selector, (el) =>
            el.getAttribute("content")
          );
          if (content) return content.trim();
        } else {
          const text = await page.$eval(selector, (el) =>
            el.textContent?.trim()
          );
          if (text) return text;
        }
      } catch {
        // Try next selector
      }
    }

    // Fallback: use page title
    const title = await page.title();
    return title.replace(/\s*[-|].*$/, "").trim() || "Unknown Product";
  }

  // === Extract Product Images ===

  private async extractProductImages(page: Page): Promise<string[]> {
    const imageUrls = await page.evaluate(() => {
      const urls: string[] = [];
      const seen = new Set<string>();

      // Get all images on the page
      const images = document.querySelectorAll("img");

      for (const img of images) {
        const src = img.src || img.getAttribute("data-src") || "";
        if (!src || src.startsWith("data:")) continue;

        // Filter for product images (skip icons, avatars, etc.)
        const isProductImage =
          (img.naturalWidth >= 200 || img.width >= 200) &&
          (img.naturalHeight >= 200 || img.height >= 200) &&
          !src.includes("avatar") &&
          !src.includes("icon") &&
          !src.includes("logo") &&
          !src.includes("emoji") &&
          !src.includes("1x1");

        if (isProductImage && !seen.has(src)) {
          seen.add(src);
          urls.push(src);
        }
      }

      // Also check background images in swiper/carousel containers
      const swiperSlides = document.querySelectorAll(
        ".swiper-slide, .carousel-item, .product-gallery-item"
      );
      for (const slide of swiperSlides) {
        const style = window.getComputedStyle(slide);
        const bgImage = style.backgroundImage;
        const match = bgImage.match(/url\(["']?(.+?)["']?\)/);
        if (match && match[1] && !seen.has(match[1])) {
          seen.add(match[1]);
          urls.push(match[1]);
        }
      }

      return urls;
    });

    return imageUrls;
  }

  // === Download Images ===

  private async downloadImages(
    page: Page,
    urls: string[],
    outputDir: string
  ): Promise<string[]> {
    const downloadedPaths: string[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const ext = this.getImageExtension(url);
      const filename = `product-${String(i + 1).padStart(2, "0")}${ext}`;
      const filePath = path.join(outputDir, filename);

      try {
        // Use page context to fetch (carries cookies/session)
        const buffer = await page.evaluate(async (imgUrl: string) => {
          const response = await fetch(imgUrl);
          const arrayBuffer = await response.arrayBuffer();
          return Array.from(new Uint8Array(arrayBuffer));
        }, url);

        fs.writeFileSync(filePath, Buffer.from(buffer));
        downloadedPaths.push(filePath);
      } catch {
        // Skip failed downloads, continue with others
        console.warn(`Failed to download image: ${url}`);
      }
    }

    return downloadedPaths;
  }

  // === Helpers ===

  private getImageExtension(url: string): string {
    const cleanUrl = url.split("?")[0];
    if (cleanUrl.endsWith(".webp")) return ".webp";
    if (cleanUrl.endsWith(".png")) return ".png";
    if (cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg")) return ".jpg";
    return ".jpg"; // default
  }
}
