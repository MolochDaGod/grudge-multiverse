/**
 * Bermuda map is served from R2 CDN — do not ship 54MB in Vercel/GitHub artifacts.
 */
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const p = join(process.cwd(), "dist", "maps", "bermuda.glb");
if (existsSync(p)) {
  unlinkSync(p);
  console.log("[build] stripped dist/maps/bermuda.glb (use assets.grudge-studio.com/models/maps/bermuda.glb)");
} else {
  console.log("[build] no dist/maps/bermuda.glb to strip");
}
