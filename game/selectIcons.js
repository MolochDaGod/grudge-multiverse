/**
 * Race + class selection icons — existing fleet art only (no new assets).
 *
 * Race portraits: open.grudge-studio.com/races/{human,elf,orc,undead,barbarian,dwarf}.png
 * Class cards:    public/ui/icons/entities/* (Toon RTS unit portraits)
 */
import { getRace } from "./fleetGearPresets.js";

const OPEN_RACES = "https://open.grudge-studio.com/races";
const ENTITIES = "/ui/icons/entities";

/** libraryId / short → race portrait filename (Open public/races). */
const RACE_PORTRAIT = {
  human: "human.png",
  "western-kingdoms": "human.png",
  elf: "elf.png",
  "high-elves": "elf.png",
  orc: "orc.png",
  orcs: "orc.png",
  undead: "undead.png",
  barbarian: "barbarian.png",
  barbarians: "barbarian.png",
  dwarf: "dwarf.png",
  dwarves: "dwarf.png",
};

/**
 * classId → unit role key used in entity icon names.
 * knight → paladin art · ranger → archer · unarmed → merc
 */
const CLASS_ROLE = {
  warrior: "warrior",
  knight: "paladin",
  ranger: "archer",
  mage: "mage",
  unarmed: "merc",
};

/** Race short → entity filename prefix variants (case-sensitive files on disk). */
const RACE_ENTITY_PREFIXES = {
  human: ["Human", "human"],
  elf: ["elf", "Elf"],
  orc: ["orc", "Orc"],
  undead: ["undead", "Undead"],
  barbarian: ["barb", "barbarian", "Barb"],
  dwarf: ["dwarf", "Dwarf", "Dwarve"],
};

/**
 * Absolute URL for race portrait (selection step 1).
 * @param {string} raceId
 */
export function racePortraitUrl(raceId) {
  const race = getRace(raceId);
  const key = race?.libraryId || race?.short || raceId;
  const file = RACE_PORTRAIT[key] || RACE_PORTRAIT[raceId] || "human.png";
  return `${OPEN_RACES}/${file}`;
}

/**
 * Candidate paths for race+class unit icon (selection step 2).
 * First path is preferred; UI falls back via onerror chain.
 * @param {string} raceId
 * @param {string} classId
 * @returns {string[]}
 */
export function classIconCandidates(raceId, classId) {
  const race = getRace(raceId);
  const short = race?.short || "human";
  const role = CLASS_ROLE[classId] || "warrior";
  const prefixes = RACE_ENTITY_PREFIXES[short] || ["Human", "human"];
  const out = [];

  for (const pre of prefixes) {
    // Match on-disk names: "Human Warrior.png", "elf mage.png", "barb archer.png"
    if (role === "merc") {
      out.push(`${ENTITIES}/${pre} Merc.PNG`);
      out.push(`${ENTITIES}/${pre} merc.PNG`);
      out.push(`${ENTITIES}/Heavy ${pre} Merc.PNG`);
    } else if (role === "mage" && pre === "barbarian") {
      out.push(`${ENTITIES}/barbarian Mage.png`);
      out.push(`${ENTITIES}/barb mage.png`);
    } else {
      const roleCap = role.charAt(0).toUpperCase() + role.slice(1);
      out.push(`${ENTITIES}/${pre} ${roleCap}.png`);
      out.push(`${ENTITIES}/${pre} ${role}.png`);
      out.push(`${ENTITIES}/${pre.toLowerCase()} ${role}.png`);
      out.push(`${ENTITIES}/${pre} ${roleCap}.PNG`);
    }
  }

  // Race portrait as last resort (still better than a letter)
  out.push(racePortraitUrl(raceId));
  // Dedupe preserve order
  return [...new Set(out)];
}

/** Preferred class icon URL (first candidate). */
export function classIconUrl(raceId, classId) {
  return classIconCandidates(raceId, classId)[0];
}

/**
 * Build avatar HTML with image + onerror fallback chain.
 * @param {string[]} urls
 * @param {string} alt
 * @param {string} [bgColor]
 */
export function avatarImgHtml(urls, alt, bgColor = "#1a2030") {
  const list = (urls || []).filter(Boolean);
  if (!list.length) {
    return `<div class="char-avatar char-avatar--letter" style="background:${bgColor}">${(alt || "?").slice(0, 1)}</div>`;
  }
  const primary = list[0];
  const rest = list
    .slice(1)
    .map((u) => u.replace(/"/g, "&quot;"))
    .join("|");
  return `
    <div class="char-avatar char-avatar--img" style="background:${bgColor}">
      <img
        src="${primary.replace(/"/g, "&quot;")}"
        alt="${(alt || "").replace(/"/g, "&quot;")}"
        data-fallbacks="${rest}"
        data-fallback-i="0"
        draggable="false"
        loading="lazy"
        onerror="window.__mvIconFallback&&window.__mvIconFallback(this)"
      />
    </div>`;
}

/** Install once: walk data-fallbacks on img error. */
export function installIconFallbackHandler() {
  if (typeof window === "undefined" || window.__mvIconFallback) return;
  window.__mvIconFallback = (img) => {
    const raw = img.getAttribute("data-fallbacks") || "";
    const parts = raw.split("|").filter(Boolean);
    let i = parseInt(img.getAttribute("data-fallback-i") || "0", 10) || 0;
    if (i < parts.length) {
      img.setAttribute("data-fallback-i", String(i + 1));
      img.src = parts[i];
      return;
    }
    // Final: letter tile
    const wrap = img.parentElement;
    if (wrap) {
      const letter = (img.alt || "?").slice(0, 1).toUpperCase();
      wrap.classList.remove("char-avatar--img");
      wrap.classList.add("char-avatar--letter");
      wrap.textContent = letter;
      wrap.style.display = "flex";
      wrap.style.alignItems = "center";
      wrap.style.justifyContent = "center";
      wrap.style.fontWeight = "800";
      wrap.style.fontSize = "22px";
      wrap.style.color = "#c8a84b";
    }
  };
}
