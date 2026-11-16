/**
 * Reproduce the built-in tweakcn color catalog as static MUI palettes.
 * Run from nodia-client: node scripts/import-tweakcn-themes.mjs
 * No application request, remote theme download or contrast search runs at startup.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "rolldown";

const revision = "a3b47b37cba97dd637de517aab52c45ec0f83456";
const upstream = `https://raw.githubusercontent.com/jnsahaj/tweakcn/${revision}/`;
const root = new URL("../", import.meta.url);
const hashes = {
  "utils/theme-presets.ts": "d333858a5a4f1e2fd615f1b73709f552e5a84c12882196456dfc48e1f09376a8",
  "config/theme.ts": "cca693548553545cd6384e1d02b30138510ed6eeb94da313e20c5f328f630da1",
  LICENSE: "c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4",
};

const sources = Object.fromEntries(await Promise.all(Object.entries(hashes).map(async ([file, expected]) => {
  const response = await fetch(`${upstream}${file}`);
  if (!response.ok) throw new Error(`Cannot read pinned tweakcn ${file}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== expected) {
    throw new Error(`Pinned tweakcn source hash mismatch: ${file}`);
  }
  return [file, new TextDecoder().decode(bytes)];
})));

// These immutable upstream files contain literal preset objects. They are not runtime inputs.
const presetCode = sources["utils/theme-presets.ts"]
  .replace(/^import[^\n]*\n/, "")
  .replace("export const defaultPresets: Record<string, ThemePreset> =", "return");
const builtIns = Function(presetCode)();
const defaultCode = sources["config/theme.ts"]
  .split("// Default theme state")[0]
  .replace(/^import[^\n]*\n/, "")
  .replaceAll("export const", "const");
const defaults = Function(`${defaultCode}; return { light: defaultLightThemeStyles, dark: defaultDarkThemeStyles };`)();

const asHex = (channels) => `#${channels.map((channel) =>
  Math.round(Math.min(1, Math.max(0, channel)) * 255).toString(16).padStart(2, "0"),
).join("")}`;

/** OKLCH → OKLab → linear sRGB (D65), sRGB transfer function, clipping, 8-bit rounding. */
const normalizeColor = (value) => {
  if (/^#[\da-f]{6}$/i.test(value)) return value.toLowerCase();
  const match = value.match(/^oklch\(([.\d]+) ([.\d]+) ([.\d]+)\)$/);
  if (!match) throw new Error(`Unsupported upstream theme color: ${value}`);
  const [lightness, chroma, hue] = match.slice(1).map(Number);
  const angle = hue * Math.PI / 180;
  const a = chroma * Math.cos(angle);
  const b = chroma * Math.sin(angle);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return asHex(linear.map((channel) => channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * channel ** (1 / 2.4) - 0.055));
};

const tokenKeys = {
  background: "background", foreground: "foreground", card: "card", popover: "popover",
  primary: "primary", primaryForeground: "primary-foreground",
  secondaryForeground: "secondary-foreground", accentForeground: "accent-foreground",
  mutedForeground: "muted-foreground", destructive: "destructive",
  destructiveForeground: "destructive-foreground", border: "border",
};
const normalizeTokens = (tokens) => Object.fromEntries(Object.entries(tokenKeys)
  .map(([name, source]) => [name, normalizeColor(tokens[source])]));

const temporary = new URL("node_modules/.tmp/tweakcn-import/adapter.mjs", root);
await mkdir(new URL("./", temporary), { recursive: true });
await build({
  input: fileURLToPath(new URL("src/themes/adaptTweakcn.ts", root)),
  external: ["@mui/material/styles"],
  output: { file: fileURLToPath(temporary), format: "esm" },
});
const { createTweakcnPreset } = await import(pathToFileURL(fileURLToPath(temporary)).href);

const paletteFields = ["mode", "primary", "secondary", "tertiary", "error", "warning", "success", "info",
  "background", "text", "border", "divider", "contrastThreshold", "action"];
const catalog = { "tweakcn-default": { label: "Tweakcn Default", styles: defaults }, ...builtIns };
const names = [];
const themeDirectory = new URL("src/themes/", root);
await mkdir(themeDirectory, { recursive: true });
for (const [id, source] of Object.entries(catalog)) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Unsupported theme id: ${id}`);
  const variable = id.replace(/-([a-z\d])/g, (_, character) => character.toUpperCase());
  const merged = {
    light: { ...defaults.light, ...source.styles.light },
    dark: { ...defaults.dark, ...source.styles.light, ...source.styles.dark },
  };
  const preset = createTweakcnPreset(id, source.label, {
    light: normalizeTokens(merged.light), dark: normalizeTokens(merged.dark),
  });
  const palettes = Object.fromEntries(["light", "dark"].map((mode) =>
    [mode, Object.fromEntries(paletteFields.map((field) => [field, preset[mode][field]]))],
  ));
  const literal = JSON.stringify({ id, name: source.label, ...palettes }, null, 2)
    .replace('"light": {', '"light": {\n    ...lightPalette,')
    .replace('"dark": {', '"dark": {\n    ...darkPalette,');
  const content = `// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const ${variable}: AppThemePreset = ${literal};

export default ${variable};
`;
  await writeFile(new URL(`${id}.ts`, themeDirectory), content, "utf8");
  names.push({ id, variable });
}

const index = `import nodia from "./nodia";
${names.map(({ id, variable }) => `import ${variable} from "./${id}";`).join("\n")}
import type { AppThemePreset } from "./types";

export type { AppThemePreset } from "./types";
export const DEFAULT_THEME_ID = "nodia";

export const themePresets: readonly AppThemePreset[] = [
  nodia,
${names.map(({ variable }) => `  ${variable},`).join("\n")}
];

const presetsById = new Map(themePresets.map((preset) => [preset.id, preset]));

export const isThemePresetId = (value: unknown): value is string =>
  typeof value === "string" && presetsById.has(value);

export const resolveThemePreset = (value: unknown): AppThemePreset =>
  (typeof value === "string" ? presetsById.get(value) : undefined) ?? nodia;
`;
await writeFile(new URL("index.ts", themeDirectory), index, "utf8");
const licenseDirectory = new URL("public/licenses/", root);
await mkdir(licenseDirectory, { recursive: true });
await writeFile(new URL("tweakcn.txt", licenseDirectory),
  `tweakcn — https://github.com/jnsahaj/tweakcn\nSource revision: ${revision}\nAdaptation: Nodia MUI color palettes; source fonts/geometry/shadows excluded.\n\n${sources.LICENSE.replaceAll("\r\n", "\n")}`, "utf8");
// Reading back also verifies that the deployed notice is a real, nonempty artifact.
if (!(await readFile(new URL("tweakcn.txt", licenseDirectory), "utf8")).includes("Apache License")) {
  throw new Error("Missing tweakcn license notice");
}
console.log(`Generated ${names.length} static tweakcn palettes plus the existing Nodia default.`);
