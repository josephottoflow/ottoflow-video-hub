/**
 * GOOGLE SHEETS AGENT — Product Tracking Hub
 * Reads TikTok links, updates status, writes video URLs back.
 * The command center for the entire pipeline.
 */

import { google, sheets_v4 } from "googleapis";
import { getConfig } from "../config/config";

// === Types ===

export type ProductStatus =
  | "pending"
  | "scraping"
  | "processing"
  | "rendering"
  | "approval"
  | "rejected"
  | "seo"
  | "exporting"
  | "done"
  | "error";

export interface ProductRow {
  rowIndex: number;
  productName: string;
  tiktokLink: string;
  imageFolder: string;
  description: string;
  hashtags: string;
  status: ProductStatus;
  videoUrl: string;
  dateAdded: string;
  imageCount: number;
  errorMessage: string;
}

// === Column Mapping ===
// A=Product Name, B=TikTok Link, C=Image Folder, D=Description, E=Hashtags,
// F=Status, G=Video URL, H=Date Added, I=Image Count, J=Error

const COLUMNS = {
  productName: "A",
  tiktokLink: "B",
  imageFolder: "C",
  description: "D",
  hashtags: "E",
  status: "F",
  videoUrl: "G",
  dateAdded: "H",
  imageCount: "I",
  errorMessage: "J",
} as const;

const HEADER_ROW = [
  "Product Name",
  "TikTok Link",
  "Image Folder",
  "Description",
  "Hashtags",
  "Status",
  "Video URL",
  "Date Added",
  "Image Count",
  "Error",
];

// === Sheets Client ===

export class SheetsClient {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;
  private sheetName: string;

  constructor(sheetName: string = "Products") {
    const config = getConfig();
    this.spreadsheetId = config.google.spreadsheetId;
    this.sheetName = sheetName;

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.google.serviceAccountEmail,
        private_key: config.google.privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    this.sheets = google.sheets({ version: "v4", auth });
  }

  // === Initialize Sheet with Headers ===

  async initializeSheet(): Promise<void> {
    const range = `${this.sheetName}!A1:J1`;

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      // If headers already exist, skip
      if (response.data.values && response.data.values.length > 0) {
        return;
      }
    } catch {
      // Sheet might not exist yet — that's fine
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [HEADER_ROW],
      },
    });
  }

  // === Read All Products ===

  async getAllProducts(): Promise<ProductRow[]> {
    const range = `${this.sheetName}!A2:J`;
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    return rows.map((row, index) => this.parseRow(row, index + 2));
  }

  // === Get Pending Products (ready to process) ===

  async getPendingProducts(): Promise<ProductRow[]> {
    const products = await this.getAllProducts();
    return products.filter(
      (p) => p.status === "pending" && p.imageFolder.trim() !== ""
    );
  }

  // === Update Status ===

  async updateStatus(
    rowIndex: number,
    status: ProductStatus,
    errorMessage?: string
  ): Promise<void> {
    const statusRange = `${this.sheetName}!${COLUMNS.status}${rowIndex}`;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: statusRange,
      valueInputOption: "RAW",
      requestBody: {
        values: [[status]],
      },
    });

    if (errorMessage !== undefined) {
      const errorRange = `${this.sheetName}!${COLUMNS.errorMessage}${rowIndex}`;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: errorRange,
        valueInputOption: "RAW",
        requestBody: {
          values: [[errorMessage]],
        },
      });
    }
  }

  // === Update Video URL (when rendering is complete) ===

  async updateVideoUrl(rowIndex: number, videoUrl: string): Promise<void> {
    const range = `${this.sheetName}!${COLUMNS.videoUrl}${rowIndex}`;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [[videoUrl]],
      },
    });
  }

  // === Update Image Count ===

  async updateImageCount(rowIndex: number, count: number): Promise<void> {
    const range = `${this.sheetName}!${COLUMNS.imageCount}${rowIndex}`;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [[count]],
      },
    });
  }

  // === Add Product Row ===

  async addProduct(
    productName: string,
    imageFolder: string,
    description: string = "",
    hashtags: string = ""
  ): Promise<number> {
    const range = `${this.sheetName}!A:J`;
    const dateAdded = new Date().toISOString().split("T")[0];

    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [[productName, "", imageFolder, description, hashtags, "pending", "", dateAdded, 0, ""]],
      },
    });

    // Extract the row number from the updated range
    const updatedRange = response.data.updates?.updatedRange || "";
    const match = updatedRange.match(/!A(\d+)/);
    return match ? parseInt(match[1]) : -1;
  }

  // === Batch Update (for pipeline completion) ===

  async markComplete(
    rowIndex: number,
    videoUrl: string,
    imageCount: number
  ): Promise<void> {
    const range = `${this.sheetName}!${COLUMNS.status}${rowIndex}:${COLUMNS.errorMessage}${rowIndex}`;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          "done",
          videoUrl,
          "", // dateAdded stays
          imageCount,
          "", // clear error
        ]],
      },
    });
  }

  // === Helper: Parse Row ===

  private parseRow(row: string[], rowIndex: number): ProductRow {
    return {
      rowIndex,
      productName: row[0] || "",
      tiktokLink: row[1] || "",
      imageFolder: row[2] || "",
      description: row[3] || "",
      hashtags: row[4] || "",
      status: (row[5] as ProductStatus) || "pending",
      videoUrl: row[6] || "",
      dateAdded: row[7] || "",
      imageCount: parseInt(row[8]) || 0,
      errorMessage: row[9] || "",
    };
  }
}
