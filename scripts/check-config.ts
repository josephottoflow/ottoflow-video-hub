import "dotenv/config";
import { getConfig } from "../src/agents/config/config";

async function main() {
  const c = getConfig();
  console.log("outputDir:", c.app.outputDir);
  console.log("tempDir:", c.app.tempDir);
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
