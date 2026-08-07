/**
 * Multiverse grudge6 mesh equip SSOT — label every kit mesh, resolve armor/weapon
 * from gear_presets + bag loadout, apply visibility only (never whole-model swap).
 *
 * Slot taxonomy matches fleet EquipmentManager:
 *   body | arms | legs | head | shoulders | sword | axe | bow | staff | shield | quiver | bag | wood
 */
import * as THREE from "three";

/** Exclusive groups — one visible mesh per group when equipping. */
export const EXCLUSIVE_GROUPS = {
  armor_body: "body",
  armor_arms: "arms",
  armor_legs: "legs",
  armor_head: "head",
  armor_shoulders: "shoulders",
  weapon_r: "weapon",
  weapon_l: "weapon_l",
  offhand: "shield",
  utility: "utility",
};

/**
 * Human-readable label from mesh name.
 * WK_Units_Body_C → "Body C" · ORC_weapon_Axe_B → "Axe B"
 */
export function meshLabelFromName(name) {
  const raw = String(name || "").replace(/_/g, " ").trim();
  if (!raw) return "Mesh";
  return raw
    .replace(/^(WK|BRB|ORC|ELF|UD|DWF)\s+/i, "")
    .replace(/\bUnits\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/**
 * Classify a kit mesh into equip slot + category.
 * @returns {{ slot: string, category: 'armor'|'weapon'|'offhand'|'utility'|'body'|'other', variant: string, label: string }}
 */
export function classifyMesh(name) {
  const n = String(name || "");
  const low = n.toLowerCase();
  const variant = (low.match(/_([a-z0-9])$/i) || low.match(/([a-z])$/i) || [])[1] || "";
  const label = meshLabelFromName(n);

  if (/shoulder|shoulderpads/i.test(n)) {
    return { slot: "shoulders", category: "armor", variant, label: label || "Shoulders" };
  }
  if (/\bhead\b|units_head/i.test(low)) {
    return { slot: "head", category: "armor", variant, label: label || "Head" };
  }
  if (/\bbody\b|units_body/i.test(low)) {
    return { slot: "body", category: "armor", variant, label: label || "Body" };
  }
  if (/\barms\b|units_arms/i.test(low)) {
    return { slot: "arms", category: "armor", variant, label: label || "Arms" };
  }
  if (/\blegs\b|units_legs/i.test(low)) {
    return { slot: "legs", category: "armor", variant, label: label || "Legs" };
  }
  if (/shield/i.test(n)) {
    return { slot: "shield", category: "offhand", variant, label: label || "Shield" };
  }
  if (/quiver/i.test(n)) {
    return { slot: "quiver", category: "utility", variant, label: label || "Quiver" };
  }
  if (/bag|xtra_bag/i.test(low)) {
    return { slot: "bag", category: "utility", variant, label: label || "Bag" };
  }
  if (/wood|xtra_wood/i.test(low)) {
    return { slot: "wood", category: "utility", variant, label: label || "Wood" };
  }
  if (/bow/i.test(n)) {
    return { slot: "bow", category: "weapon", variant, label: label || "Bow" };
  }
  if (/staff/i.test(n)) {
    return { slot: "staff", category: "weapon", variant, label: label || "Staff" };
  }
  if (/axe/i.test(n)) {
    return { slot: "axe", category: "weapon", variant, label: label || "Axe" };
  }
  if (/sword/i.test(n)) {
    return { slot: "sword", category: "weapon", variant, label: label || "Sword" };
  }
  if (/spear/i.test(n)) {
    return { slot: "spear", category: "weapon", variant, label: label || "Spear" };
  }
  if (/hammer|mace|dagger|pick/i.test(n)) {
    return { slot: "melee", category: "weapon", variant, label: label || "Weapon" };
  }
  if (/weapon/i.test(n)) {
    return { slot: "weapon", category: "weapon", variant, label: label || "Weapon" };
  }
  return { slot: "other", category: "other", variant, label };
}

export function normMeshKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/^wk_|^brb_|^orc_|^elf_|^ud_|^dwf_/, "")
    .replace(/units_/g, "")
    .replace(/xtra_/g, "")
    .replace(/weapon_/g, "weapon")
    .replace(/shield_/g, "shield")
    .replace(/shoulderpads_/g, "shoulders")
    .replace(/[^a-z0-9]/g, "");
}

export function meshMatchesId(meshName, meshId) {
  if (!meshName || !meshId) return false;
  if (meshName === meshId) return true;
  if (meshName.endsWith(meshId) || meshId.endsWith(meshName)) return true;
  const a = normMeshKey(meshName);
  const b = normMeshKey(meshId);
  return a === b || a.endsWith(b) || b.endsWith(a);
}

/**
 * Catalog all meshes, stamp userData labels for tools / panel / soft-lock.
 * @returns {Array<{ name: string, slot: string, category: string, variant: string, label: string, object: THREE.Object3D }>}
 */
export function catalogAndLabelMeshes(root) {
  /** @type {Array<{ name: string, slot: string, category: string, variant: string, label: string, object: THREE.Object3D }>} */
  const out = [];
  if (!root) return out;
  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const name = o.name || o.uuid;
    const cls = classifyMesh(name);
    o.userData.meshId = name;
    o.userData.meshKey = normMeshKey(name);
    o.userData.slot = cls.slot;
    o.userData.category = cls.category;
    o.userData.variant = cls.variant;
    o.userData.label = cls.label;
    o.userData.equipSlot = cls.slot;
    // Friendly display for debug / inspectors
    if (!o.userData.displayName) o.userData.displayName = cls.label;
    out.push({
      name,
      slot: cls.slot,
      category: cls.category,
      variant: cls.variant,
      label: cls.label,
      object: o,
    });
  });
  return out;
}

/** Bag item id → weapon family for kit meshes. */
export function weaponFamilyFromItem(item) {
  if (!item) return null;
  const blob = `${item.id || ""} ${item.name || ""} ${item.meshSlot || ""}`.toLowerCase();
  if (/bow|longbow|yew/.test(blob)) return "bow";
  if (/staff|wand|oak|arcane/.test(blob)) return "staff";
  if (/axe|worge|berserk/.test(blob)) return "axe";
  if (/spear/.test(blob)) return "spear";
  if (/unarmed|fist|glove/.test(blob)) return "none";
  if (/sword|blade|iron/.test(blob)) return "sword";
  return "sword";
}

/**
 * Armor tier → prefer heavier/lighter body letter when multiple exist.
 * t0 cloth/leather → A–B, t0 mail → C, t1 heavy → D–F
 */
export function armorTierHint(item) {
  if (!item) return null;
  const blob = `${item.id || ""} ${item.name || ""}`.toLowerCase();
  const tier = item.tier ?? 0;
  if (/robe|cloth|mage/.test(blob)) return { prefer: ["a", "b"], family: "light" };
  if (/leather|scout|hide/.test(blob)) return { prefer: ["b", "a", "c"], family: "medium" };
  if (/mail|plate|iron|heavy|knight/.test(blob) || tier >= 1) {
    return { prefer: ["e", "f", "d", "c"], family: "heavy" };
  }
  return { prefer: ["c", "b", "d"], family: "medium" };
}

/**
 * Build final visible mesh name list from class preset + equipped loadout.
 * @param {string[]} basePresetIds gear_presets mesh_ids
 * @param {Array} catalog from catalogAndLabelMeshes
 * @param {{ weapon?: object, armor?: object, offhand?: object }} loadout
 */
export function resolveVisibleMeshes(basePresetIds, catalog, loadout = {}) {
  const bySlot = new Map();
  for (const e of catalog) {
    if (!bySlot.has(e.slot)) bySlot.set(e.slot, []);
    bySlot.get(e.slot).push(e);
  }

  /** @type {Map<string, string>} slot → mesh name */
  const chosen = new Map();

  // 1) Seed from class gear_presets mesh_ids
  for (const id of basePresetIds || []) {
    const hit = catalog.find((c) => meshMatchesId(c.name, id));
    if (hit) chosen.set(hit.slot, hit.name);
  }

  // 2) Armor item → body (and optionally arms/legs if empty)
  const armorHint = armorTierHint(loadout.armor);
  if (armorHint && bySlot.get("body")?.length) {
    const bodies = bySlot.get("body");
    let pick = bodies.find((b) => armorHint.prefer.includes((b.variant || "").toLowerCase()));
    if (!pick) pick = bodies[Math.min(bodies.length - 1, loadout.armor?.tier === 1 ? bodies.length - 1 : 0)];
    if (pick) chosen.set("body", pick.name);
  }

  // 3) Weapon item → exclusive weapon family
  const fam = weaponFamilyFromItem(loadout.weapon);
  if (fam === "none") {
    for (const s of ["sword", "axe", "bow", "staff", "spear", "melee", "weapon", "quiver"]) {
      chosen.delete(s);
    }
  } else if (fam) {
    // Clear other weapon families
    for (const s of ["sword", "axe", "bow", "staff", "spear", "melee", "weapon"]) {
      if (s !== fam) chosen.delete(s);
    }
    if (fam !== "bow") chosen.delete("quiver");
    const pool = bySlot.get(fam) || bySlot.get("weapon") || [];
    // Prefer preset mesh still in same family
    const preferNames = new Set(basePresetIds || []);
    let w =
      pool.find((p) => preferNames.has(p.name)) ||
      pool.find((p) => (p.variant || "").toLowerCase() === "b") ||
      pool[0];
    if (w) chosen.set(fam, w.name);
    if (fam === "bow") {
      const q = bySlot.get("quiver")?.[0];
      if (q) chosen.set("quiver", q.name);
    }
  }

  // 4) Offhand shield
  if (loadout.offhand || (fam === "sword" && !loadout.weapon)) {
    const shields = bySlot.get("shield") || [];
    const preferNames = new Set(basePresetIds || []);
    const sh =
      shields.find((p) => preferNames.has(p.name)) ||
      shields.find((p) => (p.variant || "").toLowerCase() === "b") ||
      shields[0];
    if (sh && (loadout.offhand || fam === "sword")) chosen.set("shield", sh.name);
  } else if (fam === "bow" || fam === "staff" || fam === "axe" || fam === "none") {
    chosen.delete("shield");
  }

  // 5) Ensure core armor pieces always present (from preset or first available)
  for (const slot of ["body", "arms", "legs", "head"]) {
    if (chosen.has(slot)) continue;
    const presetHit = (basePresetIds || [])
      .map((id) => catalog.find((c) => meshMatchesId(c.name, id) && c.slot === slot))
      .find(Boolean);
    if (presetHit) chosen.set(slot, presetHit.name);
    else if (bySlot.get(slot)?.[0]) chosen.set(slot, bySlot.get(slot)[0].name);
  }

  return [...chosen.values()];
}

/**
 * Hide all equippable kit meshes → show only resolved ids. Labels stay on userData.
 * @returns {{ shown: string[], labeled: object[] }}
 */
export function applyLabeledMeshIds(root, visibleMeshes = []) {
  const catalog = catalogAndLabelMeshes(root);
  const wanted = (visibleMeshes || []).filter(Boolean).map(String);

  for (const e of catalog) {
    // Keep non-equip scaffolding visible only if not a variant piece
    if (e.category === "other") {
      // Hide LODs / extras that look like gear fragments
      if (/lod|collider|collision/i.test(e.name)) e.object.visible = false;
      continue;
    }
    e.object.visible = false;
  }

  const shown = [];
  const labeled = [];
  for (const id of wanted) {
    const hit = catalog.find((c) => meshMatchesId(c.name, id));
    if (hit) {
      hit.object.visible = true;
      hit.object.userData.equipped = true;
      hit.object.userData.equippedMeshId = id;
      shown.push(hit.name);
      labeled.push({
        name: hit.name,
        slot: hit.slot,
        category: hit.category,
        label: hit.label,
        variant: hit.variant,
      });
    }
  }

  // Fallback: single A-set body if nothing matched
  if (!shown.length) {
    console.warn("[meshEquip] no mesh_ids matched — body A fallback", visibleMeshes);
    for (const e of catalog) {
      if (e.category !== "armor") continue;
      if ((e.variant || "").toLowerCase() === "a" || /_a$/i.test(e.name)) {
        e.object.visible = true;
        shown.push(e.name);
        labeled.push({
          name: e.name,
          slot: e.slot,
          category: e.category,
          label: e.label,
          variant: e.variant,
        });
      }
    }
  }

  // Stamp inventory of equipped for HUD / panel
  if (typeof window !== "undefined") {
    window.__mvShownMeshes = shown.slice();
    window.__mvMeshLabels = labeled.slice();
    window.__mvMeshCatalog = catalog.map((c) => ({
      name: c.name,
      slot: c.slot,
      category: c.category,
      label: c.label,
      variant: c.variant,
      visible: !!c.object.visible,
    }));
  }

  return { shown, labeled, catalog };
}

/**
 * Full equip from class preset + bag loadout.
 */
export function applyCharacterEquipment(root, basePresetIds, loadout) {
  const catalog = catalogAndLabelMeshes(root);
  const ids = resolveVisibleMeshes(basePresetIds, catalog, loadout || {});
  return applyLabeledMeshIds(root, ids);
}

/** Summary for main panel mesh strip */
export function meshEquipSummary() {
  const labels = window.__mvMeshLabels || [];
  const byCat = { armor: [], weapon: [], offhand: [], utility: [] };
  for (const L of labels) {
    const k = byCat[L.category] ? L.category : "armor";
    byCat[k].push(L);
  }
  return byCat;
}
