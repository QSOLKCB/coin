// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const Core = require(path.join(root, "coin-core.js"));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  assert.ok(
    fs.existsSync(path.join(root, relativePath)),
    `missing required file: ${relativePath}`
  );
}

function near(actual, expected, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${actual} is not within ${epsilon} of ${expected}`
  );
}

const requiredFiles = [
  "index.html",
  "style.css",
  "app.js",
  "coin-core.js",
  "README.md",
  "SOURCES.md",
  "LICENSE",
  "docs/concept-thread.md",
  "tests/smoke.mjs",
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  ".nojekyll"
];

requiredFiles.forEach(exists);

for (const relativePath of [
  "index.html",
  "style.css",
  "app.js",
  "coin-core.js",
  "tests/smoke.mjs"
]) {
  assert.match(
    read(relativePath).slice(0, 180),
    /SPDX-License-Identifier:\s*MPL-2\.0/,
    `${relativePath} must declare MPL-2.0`
  );
}

new vm.Script(read("coin-core.js"), { filename: "coin-core.js" });
new vm.Script(read("app.js"), { filename: "app.js" });

assert.equal(Core.VERSION, "1.0.0");
assert.deepEqual(Core.MODES, ["external", "internal"]);
assert.ok(Core.VIEWS.includes("comparison"));
assert.ok(Core.VIEWS.includes("unwrapped"));

const equal = Core.fullOrbitSummary({
  fixedRadius: 1,
  coinRadius: 1,
  mode: "external"
});
near(equal.labTurns, 2);
near(equal.radialTurns, 1);
near(equal.orbitTurns, 1);
near(equal.boundaryTurns, 1);
near(equal.centrePathRadius, 2);
near(equal.centrePathRatio, 2);
near(equal.boundaryRatio, 1);

const sat = Core.fullOrbitSummary({
  fixedRadius: 3,
  coinRadius: 1,
  mode: "external"
});
near(sat.labTurns, 4);
near(sat.radialTurns, 3);
near(sat.orbitTurns, 1);
near(sat.centrePathRatio, 4);

const internal = Core.fullOrbitSummary({
  fixedRadius: 2,
  coinRadius: 1,
  mode: "internal"
});
near(internal.labTurns, -1);
near(internal.radialTurns, -2);
near(internal.orbitTurns, 1);
near(internal.centrePathRadius, 1);

const normalizedInternal = Core.normalizeSettings({
  fixedRadius: 1,
  coinRadius: 2,
  mode: "internal"
});
assert.ok(normalizedInternal.coinRadius < normalizedInternal.fixedRadius);
near(Core.normalizeSettings({ orbitAngle: Core.TAU }).orbitAngle, Core.TAU);

for (const geometry of [
  { fixedRadius: 1, coinRadius: 1, mode: "external" },
  { fixedRadius: 3, coinRadius: 1, mode: "external" },
  { fixedRadius: 2, coinRadius: 0.4, mode: "internal" }
]) {
  for (const angle of [0, 0.1, 1, Math.PI, Core.TAU - 0.01]) {
    const velocity = Core.contactVelocity(geometry, angle, 0.73);
    near(velocity.error, 0, 1e-10);
  }
}

const initialExternalContact = Core.contactPoint(
  { fixedRadius: 1, coinRadius: 1, mode: "external" },
  0
);
const initialExternalMarker = Core.markerPoint(
  {
    fixedRadius: 1,
    coinRadius: 1,
    mode: "external",
    markerRadius: 1,
    markerPhase: Math.PI
  },
  0
);
near(initialExternalContact.x, initialExternalMarker.x);
near(initialExternalContact.y, initialExternalMarker.y);

const initialInternalContact = Core.contactPoint(
  { fixedRadius: 2, coinRadius: 1, mode: "internal" },
  0
);
const initialInternalMarker = Core.markerPoint(
  {
    fixedRadius: 2,
    coinRadius: 1,
    mode: "internal",
    markerRadius: 1,
    markerPhase: 0
  },
  0
);
near(initialInternalContact.x, initialInternalMarker.x);
near(initialInternalContact.y, initialInternalMarker.y);

const curve = Core.sampleMarkerCurve(
  {
    fixedRadius: 1,
    coinRadius: 1,
    mode: "external",
    markerRadius: 1,
    markerPhase: Math.PI
  },
  Core.TAU,
  360
);
assert.equal(curve.length, 361);
near(curve[0].x, curve[curve.length - 1].x, 1e-9);
near(curve[0].y, curve[curve.length - 1].y, 1e-9);

const html = read("index.html");
const app = read("app.js");
const declaredIds = new Set(
  [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
);
for (const match of app.matchAll(/byId\("([^"]+)"\)/g)) {
  assert.ok(
    declaredIds.has(match[1]),
    `app.js references missing element #${match[1]}`
  );
}

assert.doesNotMatch(
  html,
  /<(?:script|img)[^>]+(?:src)=["']https?:/i,
  "runtime scripts and images must remain local"
);
assert.doesNotMatch(
  html,
  /<link[^>]+href=["']https?:/i,
  "runtime stylesheets must remain local"
);
assert.doesNotMatch(
  app,
  /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/,
  "the offline lab must not call network APIs"
);

assert.match(html, /Four-perspective comparison/);
assert.match(html, /No-slip residual/);
assert.match(html, /A planar kinematics lab—not evidence for a cosmological mechanism/);
assert.match(read("README.md"), /N_lab = \(R \+ r\) \/ r = R\/r \+ 1/);
assert.match(read("README.md"), /Sefray's centre-path hunch is therefore correct/);
assert.match(read(".github/workflows/pages.yml"), /deploy-pages@v4/);
assert.match(read(".github/workflows/ci.yml"), /node tests\/smoke\.mjs/);

console.log(
  "COIN smoke: equal-circle 2/1 frame split, external/internal no-slip invariants, offline runtime, and Pages workflow verified."
);
