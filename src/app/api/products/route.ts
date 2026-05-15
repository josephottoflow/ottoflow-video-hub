/**
 * API: /api/products
 * GET  → List all content rows from Google Sheet
 * POST → Add a new content row
 */

import { NextRequest, NextResponse } from "next/server";
import { SheetsClient } from "@/agents/sheets/client";

export async function GET() {
  try {
    const sheets = new SheetsClient();
    const products = await sheets.getAllContent();
    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { topic, style, script, hookA, hookB, hookC } = await request.json();

    if (!topic) {
      return NextResponse.json(
        { error: "topic is required" },
        { status: 400 }
      );
    }

    const sheets = new SheetsClient();
    await sheets.initializeSheet();
    const rowIndex = await sheets.addContent({ topic, style, script, hookA, hookB, hookC });

    return NextResponse.json({ success: true, rowIndex });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
