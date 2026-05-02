/**
 * CLI: Validate environment variables.
 * Usage: npm run validate-env
 */

import * as dotenv from "dotenv";
dotenv.config();

import { validateConfig } from "../agents/config/config";

const result = validateConfig();

console.log("🔐 Environment Validation\n");

if (result.valid) {
  console.log("✅ All required variables are set:\n");
  result.present.forEach((key) => console.log(`   ✓ ${key}`));
} else {
  console.log("❌ Missing variables:\n");
  result.missing.forEach((key) => console.log(`   ✗ ${key}`));
  if (result.present.length > 0) {
    console.log("\n✅ Present:\n");
    result.present.forEach((key) => console.log(`   ✓ ${key}`));
  }
  console.log("\nCopy .env.example to .env and fill in your keys.");
  process.exit(1);
}
