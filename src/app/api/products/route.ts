/**
 * API: /api/products
 * GET  → List all products from Google Sheet
 * POST → Add a new product row
 */

import { NextRequest, NextResponse } from "next/server";
import { SheetsClient } from "@/agents/sheets/client";

export async function GET() {
  try {
    const sheets = new SheetsClient();
    const products = await sheets.getAllProducts();
    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { productName, tiktokLink } = await request.json();

    if (!productName || !tiktokLink) {
      return NextResponse.json(
        { error: "productName and tiktokLink are required" },
        { status: 400 }
      );
    }

    const sheets = new SheetsClient();
    await sheets.initializeSheet();
    const rowIndex = await sheets.addProduct(productName, tiktokLink);

    return NextResponse.json({ success: true, rowIndex });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
