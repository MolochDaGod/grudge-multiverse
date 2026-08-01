/**
 * Compare Desktop icons pack vs info.grudge-studio.com master-items.
 * Usage: node scripts/compare-icons-desktop-vs-info.mjs
 */
import fs from "node:fs";
import path from "node:path";

const DESKTOP = "C:/Users/nugye/Desktop/icons/icons";
const OUT = path.resolve("reports/icon-desktop-vs-info.json");

async function main() {
  const desktopFiles = [];
  function walk(dir, prefix = "") {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(path.join(dir, ent.name), rel);
      else if (/\.(png|jpg|jpeg|webp)$/i.test(ent.name)) desktopFiles.push(rel.replace(/\\/g, "/"));
    }
  }
  walk(DESKTOP);

  const res = await fetch("https://info.grudge-studio.com/api/v1/master-items.json");
  const data = await res.json();
  const items = data.items || [];
  let github = 0;
  let assetsCdn = 0;
  let infoHost = 0;
  let none = 0;
  const brokenSamples = [];
  for (const it of items) {
    const u = it.iconUrl || "";
    if (!u) none++;
    else if (/github\.io/i.test(u)) {
      github++;
      if (brokenSamples.length < 20) brokenSamples.push({ id: it.id, iconUrl: u });
    } else if (/assets\.grudge-studio\.com/i.test(u)) assetsCdn++;
    else if (/info\.grudge-studio\.com/i.test(u)) infoHost++;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    desktop: {
      root: DESKTOP,
      fileCount: desktopFiles.length,
      folders: [...new Set(desktopFiles.map((f) => f.split("/")[0]))],
      sample: desktopFiles.slice(0, 40),
    },
    infoMasterItems: {
      total: items.length,
      iconHosts: { assetsCdn, infoHost, githubIo: github, none },
      note:
        github === 0
          ? "No github.io icon URLs (patched to info.grudge-studio.com)"
          : "Still has github.io — re-run ObjectStore master-items patch",
      brokenSamples,
    },
    multiverseLocalPack: {
      path: "public/ui/icons",
      use: "itemIcons.js DESKTOP_MAP + localIconFor heuristics",
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.infoMasterItems, null, 2));
  console.log("wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
