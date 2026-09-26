const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file));
const inventory = JSON.parse(read("docs/brand/proper-v1/MANIFEST.json"));
const tokens = JSON.parse(read("app/brand/proper-brand-tokens.json"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

test("supplied assets and tokens match the asset pack byte for byte", () => {
  const files = fs.readdirSync(path.join(root, "public/brand/proper-v1"));
  for (const file of files) {
    const original = inventory.find(item => item.path.endsWith("/" + file));
    assert.ok(original, file);
    assert.equal(hash(read("public/brand/proper-v1/" + file)), original.sha256, file);
  }
  for (const file of ["proper-brand-tokens.css", "proper-brand-tokens.json"]) {
    assert.equal(hash(read("app/brand/" + file)), inventory.find(item => item.path === "tokens/" + file).sha256);
  }
  assert.deepEqual(read("app/icon.svg"), read("public/brand/proper-v1/proper-appicon-dark.svg"));
});

test("brand identity and copy remain exact; icon uses any, never maskable", () => {
  assert.equal(tokens.name, "Proper");
  assert.equal(tokens.copy.tagline, "Everything behind your prints.");
  assert.equal(tokens.copy.promise, "Simple para empezar. Potente para crecer.");
  const manifest = read("app/manifest.ts").toString();
  assert.match(manifest, /start_url: "\/"/);
  assert.doesNotMatch(manifest, /maskable/);
  assert.match(manifest, /android-chrome-192.png/);
  assert.match(manifest, /android-chrome-512.png/);
});

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
test("primary text and functional CTA pairs meet 4.5:1; Clay remains decorative", () => {
  const c = tokens.colors;
  for (const [a, b] of [[c.ink,c.paper],[c.muted,c.paper],[c.muted,c["warm-canvas"]],[c.paper,c["proper-green"]]]) {
    const x = luminance(a), y = luminance(b);
    assert.ok((Math.max(x,y)+.05)/(Math.min(x,y)+.05) >= 4.5, a + " / " + b);
  }
  const theme = read("app/brand/proper-theme.css").toString();
  assert.doesNotMatch(theme, /(?:^|[;{])\s*color:\s*var\(--proper-clay\)/m);
});
