import "dotenv/config";
import { slugify } from "../src/lib/slug-utils";

async function main() {
  const topic = "The Six Sigma secret behind Ottoflow's video production system";
  const slug = slugify(topic);
  const cbSlug = slug.slice(0, 55);
  console.log("Slug:            ", slug);
  console.log("Slug length:     ", slug.length);
  console.log("cbSlug:          ", cbSlug);
  console.log("approve:cbSlug len:", ("approve:" + cbSlug).length);
  console.log("reject:cbSlug len: ", ("reject:" + cbSlug).length);
  console.log("retry:cbSlug len:  ", ("retry:" + cbSlug).length);
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
