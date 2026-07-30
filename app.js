// SPDX-License-Identifier: MPL-2.0
(() => {
  "use strict";

  const Core = globalThis.CoinCore;
  if (!Core) {
    throw new Error("coin-core.js must load before app.js");
  }

  const byId = (id) => document.getElementById(id);
  const canvas = byId("fieldCanvas");
  const context = canvas.getContext("2d", { alpha: false });

  const controls = {
    mode: byId("mode"),
    fixedRadius: byId("fixedRadius"),
    coinRadius: byId("coinRadius"),
    phase: byId("phase"),
    speed: byId("speed"),
    view: byId("view"),
    markerRadius: byId("markerRadius"),
    markerPhase: byId("markerPhase"),
    showCurve: byId("showCurve"),
    showCentrePath: byId("showCentrePath"),
    showContact: byId("showContact"),
    showGrid: byId("showGrid"),
    showLabels: byId("showLabels")
  };

  const outputs = {
    fixedRadius: byId("fixedRadiusValue"),
    coinRadius: byId("coinRadiusValue"),
    phase: byId("phaseValue"),
    speed: byId("speedValue"),
    markerRadius: byId("markerRadiusValue"),
    markerPhase: byId("markerPhaseValue")
  };

  const ui = {
    playToggle: byId("playToggle"),
    resetOrbit: byId("resetOrbit"),
    directionCCW: byId("directionCCW"),
    directionCW: byId("directionCW"),
    placeAtContact: byId("placeAtContact"),
    snapshot: byId("snapshot"),
    record: byId("record"),
    exportState: byId("exportState"),
    importState: byId("importState"),
    captureStatus: byId("captureStatus"),
    geometryNote: byId("geometryNote"),
    fieldTitle: byId("fieldTitle"),
    fieldSummary: byId("fieldSummary"),
    flowEyebrow: byId("flowEyebrow"),
    modeBadge: byId("modeBadge"),
    viewBadge: byId("viewBadge"),
    recordingBadge: byId("recordingBadge"),
    labTurnsReadout: byId("labTurnsReadout"),
    radialTurnsReadout: byId("radialTurnsReadout"),
    orbitTurnsReadout: byId("orbitTurnsReadout"),
    noSlipReadout: byId("noSlipReadout"),
    labFormula: byId("labFormula"),
    radialFormula: byId("radialFormula"),
    centreFormula: byId("centreFormula"),
    equationExplanation: byId("equationExplanation")
  };

  const palette = {
    background: "#050707",
    panel: "#080c0b",
    line: "#2b3633",
    grid: "rgba(229, 234, 230, 0.055)",
    gridStrong: "rgba(229, 234, 230, 0.11)",
    ink: "#e5eae6",
    muted: "#909d98",
    dim: "#5f6b67",
    accent: "#d7a957",
    accentBright: "#f0c978",
    fixed: "#e6a35f",
    coin: "#62c9c0",
    coinBright: "#9be6df",
    marker: "#f1df8a",
    path: "#8a9692",
    contact: "#d67866"
  };

  const presets = Object.freeze({
    equal: {
      fixedRadius: 1,
      coinRadius: 1,
      mode: "external",
      markerRadius: 1,
      markerPhase: Math.PI
    },
    sat: {
      fixedRadius: 3,
      coinRadius: 1,
      mode: "external",
      markerRadius: 1,
      markerPhase: Math.PI
    },
    cardioid: {
      fixedRadius: 1,
      coinRadius: 1,
      mode: "external",
      markerRadius: 1,
      markerPhase: Math.PI
    },
    internal: {
      fixedRadius: 2,
      coinRadius: 1,
      mode: "internal",
      markerRadius: 1,
      markerPhase: 0
    }
  });

  let state = Core.normalizeSettings({
    ...Core.DEFAULTS,
    view: "comparison"
  });
  let playing = true;
  let lastTimestamp = performance.now();
  let recorder = null;
  let recordingTimer = null;
  let recordingStartedAt = 0;
  let recordedChunks = [];
  let activePreset = "equal";

  function effectiveAngle() {
    return state.direction * state.orbitAngle;
  }

  function setPlaying(value) {
    playing = Boolean(value);
    ui.playToggle.textContent = playing ? "Pause orbit" : "Play orbit";
    ui.playToggle.setAttribute("aria-pressed", String(playing));
  }

  function formatRatio(value) {
    if (!Number.isFinite(value)) {
      return "∞";
    }
    if (Math.abs(value - Math.round(value)) < 1e-9) {
      return String(Math.round(value));
    }
    return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function formatTurns(value) {
    const clean = Math.abs(value) < 5e-10 ? 0 : value;
    return `${clean.toFixed(3)} turns`;
  }

  function viewLabel(view) {
    return {
      comparison: "four perspectives",
      laboratory: "laboratory frame",
      radial: "co-rotating frame",
      unwrapped: "unwrapped tangent",
      curve: "marker curve"
    }[view] || view;
  }

  function syncControls() {
    controls.mode.value = state.mode;
    controls.fixedRadius.value = String(Math.round(state.fixedRadius * 100));
    controls.coinRadius.value = String(Math.round(state.coinRadius * 100));
    controls.phase.value = String(Math.round(state.orbitAngle / Core.TAU * 3600));
    controls.speed.value = String(Math.round(state.speed * 100));
    controls.view.value = state.view;
    controls.markerRadius.value = String(Math.round(state.markerRadius * 100));
    controls.markerPhase.value = String(Math.round(Core.wrapAngle(state.markerPhase) / Math.PI * 180));
    controls.showCurve.checked = state.showCurve;
    controls.showCentrePath.checked = state.showCentrePath;
    controls.showContact.checked = state.showContact;
    controls.showGrid.checked = state.showGrid;
    controls.showLabels.checked = state.showLabels;

    outputs.fixedRadius.textContent = state.fixedRadius.toFixed(2);
    outputs.coinRadius.textContent = state.coinRadius.toFixed(2);
    outputs.phase.textContent = `${Math.round(state.orbitAngle / Core.TAU * 360)}°`;
    outputs.speed.textContent = `${state.speed.toFixed(2)} turn/s`;
    outputs.markerRadius.textContent = `${Math.round(state.markerRadius * 100)}%`;
    outputs.markerPhase.textContent = `${Math.round(Core.wrapAngle(state.markerPhase) / Math.PI * 180)}°`;

    const isCounterClockwise = state.direction > 0;
    ui.directionCCW.classList.toggle("active", isCounterClockwise);
    ui.directionCW.classList.toggle("active", !isCounterClockwise);
    ui.directionCCW.setAttribute("aria-pressed", String(isCounterClockwise));
    ui.directionCW.setAttribute("aria-pressed", String(!isCounterClockwise));

    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.classList.toggle("active", button.dataset.preset === activePreset);
    });
  }

  function updateReadout() {
    const alpha = effectiveAngle();
    const rotations = Core.rotationsAt(state, alpha);
    const summary = Core.fullOrbitSummary(state);
    const formula = Core.formula(state);
    const noSlip = Core.contactVelocity(state, alpha, state.direction).error;
    const ratio = state.fixedRadius / state.coinRadius;
    const equal = Math.abs(ratio - 1) < 1e-9;
    const modeName = state.mode === "external" ? "external rolling" : "internal rolling";

    ui.flowEyebrow.textContent = `R : r = ${formatRatio(state.fixedRadius)} : ${formatRatio(state.coinRadius)}`;
    ui.modeBadge.textContent = state.mode;
    ui.viewBadge.textContent = viewLabel(state.view);
    ui.labTurnsReadout.textContent = formatTurns(rotations.labTurns);
    ui.radialTurnsReadout.textContent = formatTurns(rotations.radialTurns);
    ui.orbitTurnsReadout.textContent = formatTurns(rotations.orbitTurns);
    ui.noSlipReadout.textContent = noSlip.toExponential(2);
    ui.labFormula.textContent = formula.lab;
    ui.radialFormula.textContent = formula.radial;
    ui.centreFormula.textContent = formula.centrePath;

    if (state.mode === "external") {
      ui.geometryNote.textContent =
        `The rolling centre follows radius R + r = ${summary.centrePathRadius.toFixed(2)}; ` +
        `one full centre path is ${summary.centrePathRatio.toFixed(3)} coin circumferences.`;
      ui.equationExplanation.textContent =
        `The centre travels 2π(R + r) = ${summary.centrePathLength.toFixed(3)} units. ` +
        `Dividing by 2πr = ${summary.coinCircumference.toFixed(3)} gives ` +
        `${summary.centrePathRatio.toFixed(3)} laboratory-frame turns.`;
    } else {
      ui.geometryNote.textContent =
        `The rolling centre follows radius R − r = ${summary.centrePathRadius.toFixed(2)}; ` +
        `internal rolling reverses the coin's spin direction.`;
      ui.equationExplanation.textContent =
        `Inside the fixed circle, the centre travels 2π(R − r). The laboratory-frame spin is ` +
        `${summary.labTurns.toFixed(3)} turns; the negative sign records the opposite orientation.`;
    }

    if (equal && state.mode === "external") {
      ui.fieldTitle.textContent = "Equal circles · external rolling";
      ui.fieldSummary.textContent =
        "At one full orbit: 2 turns against fixed space, 1 turn against the co-rotating radial frame.";
    } else {
      ui.fieldTitle.textContent =
        `${formatRatio(state.fixedRadius)} : ${formatRatio(state.coinRadius)} · ${modeName}`;
      ui.fieldSummary.textContent =
        `Full-orbit prediction: ${summary.labTurns.toFixed(3)} lab turns, ` +
        `${summary.radialTurns.toFixed(3)} radial-frame turns, plus one orbital frame turn.`;
    }
  }

  function applyState(next, preservePhase = false) {
    const phase = preservePhase ? state.orbitAngle : (next.orbitAngle ?? state.orbitAngle);
    state = Core.normalizeSettings({
      ...state,
      ...next,
      orbitAngle: phase
    });
    syncControls();
    updateReadout();
  }

  function readControls() {
    activePreset = "";
    state = Core.normalizeSettings({
      ...state,
      mode: controls.mode.value,
      fixedRadius: Number(controls.fixedRadius.value) / 100,
      coinRadius: Number(controls.coinRadius.value) / 100,
      orbitAngle: Number(controls.phase.value) / 3600 * Core.TAU,
      speed: Number(controls.speed.value) / 100,
      view: controls.view.value,
      markerRadius: Number(controls.markerRadius.value) / 100,
      markerPhase: Number(controls.markerPhase.value) / 180 * Math.PI,
      showCurve: controls.showCurve.checked,
      showCentrePath: controls.showCentrePath.checked,
      showContact: controls.showContact.checked,
      showGrid: controls.showGrid.checked,
      showLabels: controls.showLabels.checked
    });
    syncControls();
    updateReadout();
  }

  function resizeCanvas() {
    const rectangle = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(2, globalThis.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rectangle.width * pixelRatio));
    const height = Math.max(1, Math.round(rectangle.height * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    return {
      width: rectangle.width,
      height: rectangle.height,
      pixelRatio
    };
  }

  function clear(width, height) {
    context.save();
    context.fillStyle = palette.background;
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  function roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawPanelBackground(rect, title, subtitle) {
    context.save();
    roundedRectPath(context, rect.x, rect.y, rect.width, rect.height, 3);
    context.fillStyle = palette.panel;
    context.fill();
    context.strokeStyle = palette.line;
    context.lineWidth = 1;
    context.stroke();

    if (state.showLabels) {
      context.fillStyle = palette.accent;
      context.font = "700 10px IBM Plex Mono, Cascadia Mono, monospace";
      context.textBaseline = "top";
      context.fillText(title.toUpperCase(), rect.x + 12, rect.y + 10);
      if (subtitle) {
        context.fillStyle = palette.dim;
        context.font = "500 9px IBM Plex Mono, Cascadia Mono, monospace";
        context.textAlign = "right";
        context.fillText(subtitle, rect.x + rect.width - 12, rect.y + 11);
        context.textAlign = "left";
      }
    }
    context.restore();
  }

  function drawScreenGrid(rect) {
    if (!state.showGrid) {
      return;
    }
    context.save();
    context.beginPath();
    context.rect(rect.x, rect.y, rect.width, rect.height);
    context.clip();
    context.strokeStyle = palette.grid;
    context.lineWidth = 1;
    const spacing = Math.max(22, Math.min(rect.width, rect.height) / 10);
    for (let x = rect.x; x <= rect.x + rect.width; x += spacing) {
      context.beginPath();
      context.moveTo(x, rect.y);
      context.lineTo(x, rect.y + rect.height);
      context.stroke();
    }
    for (let y = rect.y; y <= rect.y + rect.height; y += spacing) {
      context.beginPath();
      context.moveTo(rect.x, y);
      context.lineTo(rect.x + rect.width, y);
      context.stroke();
    }
    context.restore();
  }

  function makeWorldMapper(rect, frame) {
    const outerExtent = state.mode === "external"
      ? state.fixedRadius + state.coinRadius * (1 + state.markerRadius)
      : state.fixedRadius + state.coinRadius * Math.max(0.15, state.markerRadius - 1);
    const extent = Math.max(0.5, outerExtent) * 1.18;
    const scale = Math.min(rect.width, rect.height) * 0.43 / extent;
    const centreX = rect.x + rect.width / 2;
    const centreY = rect.y + rect.height / 2 + (state.showLabels ? 8 : 0);
    const alpha = effectiveAngle();

    function framePoint(point) {
      return frame === "radial"
        ? Core.transformPoint(point, -alpha)
        : point;
    }

    function map(point) {
      const transformed = framePoint(point);
      return {
        x: centreX + transformed.x * scale,
        y: centreY - transformed.y * scale
      };
    }

    return {
      map,
      framePoint,
      scale,
      centreX,
      centreY,
      extent
    };
  }

  function drawCircle(point, radius, mapper, stroke, width, fill, dash) {
    const centre = mapper.map(point);
    context.save();
    context.beginPath();
    context.arc(centre.x, centre.y, Math.abs(radius * mapper.scale), 0, Core.TAU);
    if (dash) {
      context.setLineDash(dash);
    }
    if (fill) {
      context.fillStyle = fill;
      context.fill();
    }
    context.strokeStyle = stroke;
    context.lineWidth = width;
    context.stroke();
    context.restore();
  }

  function drawLine(from, to, mapper, stroke, width, dash) {
    const start = mapper.map(from);
    const finish = mapper.map(to);
    context.save();
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(finish.x, finish.y);
    if (dash) {
      context.setLineDash(dash);
    }
    context.strokeStyle = stroke;
    context.lineWidth = width;
    context.stroke();
    context.restore();
  }

  function sampleCurve(endAngle, samples = 420) {
    const count = Math.max(2, samples);
    const points = [];
    for (let index = 0; index <= count; index += 1) {
      const t = endAngle * index / count;
      points.push(Core.markerPoint(state, t));
    }
    return points;
  }

  function drawPolyline(points, mapper, stroke, width, alpha = 1, dash) {
    if (points.length < 2) {
      return;
    }
    context.save();
    context.beginPath();
    const first = mapper.map(points[0]);
    context.moveTo(first.x, first.y);
    for (let index = 1; index < points.length; index += 1) {
      const point = mapper.map(points[index]);
      context.lineTo(point.x, point.y);
    }
    if (dash) {
      context.setLineDash(dash);
    }
    context.globalAlpha = alpha;
    context.strokeStyle = stroke;
    context.lineWidth = width;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();
    context.restore();
  }

  function drawWorldAxes(mapper, frame) {
    if (!state.showGrid) {
      return;
    }
    const extent = mapper.extent;
    drawLine({ x: -extent, y: 0 }, { x: extent, y: 0 }, mapper, palette.gridStrong, 1);
    drawLine({ x: 0, y: -extent }, { x: 0, y: extent }, mapper, palette.gridStrong, 1);

    const alpha = effectiveAngle();
    if (frame === "radial") {
      const worldX = Core.transformPoint({ x: state.fixedRadius, y: 0 }, -alpha);
      drawLine({ x: 0, y: 0 }, Core.transformPoint(worldX, alpha), mapper, palette.accent, 1, [4, 4]);
    }
  }

  function drawWorldPanel(rect, frame, curveOnly = false) {
    const title = frame === "radial" ? "Co-rotating radial frame" :
      frame === "curve" ? "Marker curve" : "Laboratory frame";
    const subtitle = frame === "radial" ? "subtract α" :
      frame === "curve" ? "roulette locus" : "fixed space";
    drawPanelBackground(rect, title, subtitle);
    drawScreenGrid(rect);

    context.save();
    context.beginPath();
    context.rect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    context.clip();

    const mapper = makeWorldMapper(rect, frame);
    const alpha = effectiveAngle();
    const centre = Core.centreAt(state, alpha);
    const contact = Core.contactPoint(state, alpha);
    const marker = Core.markerPoint(state, alpha);
    const fixedSpokeAngle = frame === "radial" ? -alpha : 0;

    drawWorldAxes(mapper, frame);

    if (state.showCurve || curveOnly) {
      const fullCurve = sampleCurve(state.direction * Core.TAU, 540);
      drawPolyline(fullCurve, mapper, palette.coin, curveOnly ? 1.8 : 1.1, curveOnly ? 0.55 : 0.17);
      const completed = sampleCurve(alpha, Math.max(24, Math.round(Math.abs(alpha) / Core.TAU * 540)));
      drawPolyline(completed, mapper, palette.coinBright, curveOnly ? 2.8 : 2.1, 0.9);
    }

    if (!curveOnly) {
      drawCircle({ x: 0, y: 0 }, state.fixedRadius, mapper, palette.fixed, 2, "rgba(230, 163, 95, 0.035)");

      const fixedSpoke = {
        x: state.fixedRadius * Math.cos(fixedSpokeAngle),
        y: state.fixedRadius * Math.sin(fixedSpokeAngle)
      };
      if (frame === "radial") {
        const screenOrigin = mapper.map({ x: 0, y: 0 });
        const screenSpoke = {
          x: mapper.centreX + fixedSpoke.x * mapper.scale,
          y: mapper.centreY - fixedSpoke.y * mapper.scale
        };
        context.save();
        context.beginPath();
        context.moveTo(screenOrigin.x, screenOrigin.y);
        context.lineTo(screenSpoke.x, screenSpoke.y);
        context.strokeStyle = palette.fixed;
        context.lineWidth = 1.3;
        context.stroke();
        context.restore();
      } else {
        drawLine({ x: 0, y: 0 }, fixedSpoke, mapper, palette.fixed, 1.3);
      }

      if (state.showCentrePath) {
        drawCircle(
          { x: 0, y: 0 },
          Core.orbitRadius(state),
          mapper,
          palette.path,
          1.2,
          null,
          [6, 6]
        );
      }

      drawLine({ x: 0, y: 0 }, centre, mapper, "rgba(144,157,152,0.42)", 1, [4, 5]);
      drawCircle(centre, state.coinRadius, mapper, palette.coin, 2.2, "rgba(98, 201, 192, 0.055)");

      const orientationTip = {
        x: centre.x + state.coinRadius * 0.82 * Math.cos(Core.orientationAt(state, alpha)),
        y: centre.y + state.coinRadius * 0.82 * Math.sin(Core.orientationAt(state, alpha))
      };
      drawLine(centre, orientationTip, mapper, palette.coinBright, 2);

      drawLine(centre, marker, mapper, "rgba(241,223,138,0.56)", 1.2);

      if (state.showContact) {
        const contactScreen = mapper.map(contact);
        context.save();
        context.beginPath();
        context.arc(contactScreen.x, contactScreen.y, 4.2, 0, Core.TAU);
        context.fillStyle = palette.contact;
        context.fill();

        const tangent = {
          x: -Math.sin(alpha),
          y: Math.cos(alpha)
        };
        const tangentLength = Math.min(state.fixedRadius, state.coinRadius) * 0.42;
        const tangentA = {
          x: contact.x - tangent.x * tangentLength,
          y: contact.y - tangent.y * tangentLength
        };
        const tangentB = {
          x: contact.x + tangent.x * tangentLength,
          y: contact.y + tangent.y * tangentLength
        };
        context.restore();
        drawLine(tangentA, tangentB, mapper, palette.contact, 1.2);
      }
    }

    const markerScreen = mapper.map(marker);
    context.save();
    context.beginPath();
    context.arc(markerScreen.x, markerScreen.y, curveOnly ? 5 : 4, 0, Core.TAU);
    context.fillStyle = palette.marker;
    context.shadowColor = palette.marker;
    context.shadowBlur = 10;
    context.fill();
    context.restore();

    if (state.showLabels) {
      const centreScreen = mapper.map(centre);
      context.save();
      context.font = "600 9px IBM Plex Mono, Cascadia Mono, monospace";
      context.fillStyle = palette.coinBright;
      context.fillText("C", centreScreen.x + 7, centreScreen.y - 7);
      context.fillStyle = palette.marker;
      context.fillText("P", markerScreen.x + 7, markerScreen.y - 7);
      context.restore();
    }

    context.restore();

    if (state.showLabels) {
      const rotations = Core.rotationsAt(state, alpha);
      context.save();
      context.fillStyle = palette.muted;
      context.font = "600 9px IBM Plex Mono, Cascadia Mono, monospace";
      context.textBaseline = "bottom";
      const value = frame === "radial" ? rotations.radialTurns : rotations.labTurns;
      context.fillText(`${value.toFixed(3)} turns`, rect.x + 12, rect.y + rect.height - 10);
      context.restore();
    }
  }

  function drawUnwrappedPanel(rect) {
    drawPanelBackground(rect, "Unwrapped tangent frame", "boundary length = 2πR");
    drawScreenGrid(rect);

    context.save();
    context.beginPath();
    context.rect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    context.clip();

    const alpha = effectiveAngle();
    const fraction = Math.min(1, Math.abs(alpha) / Core.TAU);
    const padding = Math.max(30, rect.width * 0.08);
    const left = rect.x + padding;
    const right = rect.x + rect.width - padding;
    const trackWidth = right - left;
    const lineY = rect.y + rect.height * 0.62;
    const direction = alpha >= 0 ? 1 : -1;
    const x = direction > 0
      ? left + trackWidth * fraction
      : right - trackWidth * fraction;
    const radiusPixels = Math.max(
      12,
      Math.min(rect.height * 0.19, trackWidth * 0.11 * state.coinRadius / state.fixedRadius)
    );
    const above = state.mode === "external";
    const centreY = lineY + (above ? -radiusPixels : radiusPixels);
    const boundaryTurns = Core.rotationsAt(state, alpha).boundaryTurns;
    const displayedOrientation = boundaryTurns * Core.TAU;

    context.save();
    context.strokeStyle = palette.fixed;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(left, lineY);
    context.lineTo(right, lineY);
    context.stroke();

    const ratio = state.fixedRadius / state.coinRadius;
    const tickCount = Math.min(24, Math.max(1, Math.ceil(ratio)));
    for (let index = 0; index <= tickCount; index += 1) {
      const tx = left + trackWidth * index / tickCount;
      context.beginPath();
      context.moveTo(tx, lineY - 4);
      context.lineTo(tx, lineY + 4);
      context.strokeStyle = index === 0 || index === tickCount ? palette.fixed : palette.line;
      context.lineWidth = 1;
      context.stroke();
    }

    context.beginPath();
    context.arc(x, centreY, radiusPixels, 0, Core.TAU);
    context.fillStyle = "rgba(98, 201, 192, 0.06)";
    context.fill();
    context.strokeStyle = palette.coin;
    context.lineWidth = 2.2;
    context.stroke();

    const tickX = x + radiusPixels * 0.82 * Math.cos(displayedOrientation);
    const tickY = centreY - radiusPixels * 0.82 * Math.sin(displayedOrientation);
    context.beginPath();
    context.moveTo(x, centreY);
    context.lineTo(tickX, tickY);
    context.strokeStyle = palette.coinBright;
    context.lineWidth = 2;
    context.stroke();

    const markerAngle = displayedOrientation + state.markerPhase;
    const markerRadius = radiusPixels * state.markerRadius;
    const markerX = x + markerRadius * Math.cos(markerAngle);
    const markerY = centreY - markerRadius * Math.sin(markerAngle);
    context.beginPath();
    context.arc(markerX, markerY, 4, 0, Core.TAU);
    context.fillStyle = palette.marker;
    context.shadowColor = palette.marker;
    context.shadowBlur = 10;
    context.fill();

    context.setLineDash([5, 5]);
    context.strokeStyle = palette.path;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(direction > 0 ? left : right, centreY);
    context.lineTo(x, centreY);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = palette.muted;
    context.font = "600 9px IBM Plex Mono, Cascadia Mono, monospace";
    context.textBaseline = "bottom";
    context.fillText(
      `boundary rolling: ${boundaryTurns.toFixed(3)} turns`,
      rect.x + 12,
      rect.y + rect.height - 10
    );
    context.restore();

    context.restore();
  }

  function comparisonRects(width, height) {
    const margin = 12;
    const gap = 10;
    const usableWidth = width - margin * 2 - gap;
    const usableHeight = height - margin * 2 - gap;
    const cellWidth = usableWidth / 2;
    const cellHeight = usableHeight / 2;
    return [
      { x: margin, y: margin, width: cellWidth, height: cellHeight },
      { x: margin + cellWidth + gap, y: margin, width: cellWidth, height: cellHeight },
      { x: margin, y: margin + cellHeight + gap, width: cellWidth, height: cellHeight },
      { x: margin + cellWidth + gap, y: margin + cellHeight + gap, width: cellWidth, height: cellHeight }
    ];
  }

  function singleRect(width, height) {
    return {
      x: 12,
      y: 12,
      width: Math.max(10, width - 24),
      height: Math.max(10, height - 24)
    };
  }

  function render() {
    const dimensions = resizeCanvas();
    clear(dimensions.width, dimensions.height);

    if (state.view === "comparison") {
      const [lab, radial, unwrapped, curve] = comparisonRects(dimensions.width, dimensions.height);
      drawWorldPanel(lab, "laboratory");
      drawWorldPanel(radial, "radial");
      drawUnwrappedPanel(unwrapped);
      drawWorldPanel(curve, "curve", true);
      return;
    }

    const rect = singleRect(dimensions.width, dimensions.height);
    if (state.view === "unwrapped") {
      drawUnwrappedPanel(rect);
    } else if (state.view === "radial") {
      drawWorldPanel(rect, "radial");
    } else if (state.view === "curve") {
      drawWorldPanel(rect, "curve", true);
    } else {
      drawWorldPanel(rect, "laboratory");
    }
  }

  function updateAnimation(timestamp) {
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - lastTimestamp) / 1000));
    lastTimestamp = timestamp;

    if (playing) {
      state.orbitAngle = Core.wrapAngle(
        state.orbitAngle + deltaSeconds * state.speed * Core.TAU
      );
      controls.phase.value = String(Math.round(state.orbitAngle / Core.TAU * 3600));
      outputs.phase.textContent = `${Math.round(state.orbitAngle / Core.TAU * 360)}°`;
      updateReadout();
    }

    if (recorder && recorder.state === "recording") {
      const seconds = Math.floor((performance.now() - recordingStartedAt) / 1000);
      ui.recordingBadge.textContent = `REC 00:${String(seconds).padStart(2, "0")}`;
    }

    render();
    requestAnimationFrame(updateAnimation);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function timestampSlug() {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }

  function snapshot() {
    render();
    canvas.toBlob((blob) => {
      if (!blob) {
        ui.captureStatus.textContent = "PNG capture failed in this browser.";
        return;
      }
      downloadBlob(blob, `coin-paradox-${timestampSlug()}.png`);
      ui.captureStatus.textContent = "PNG snapshot saved locally.";
    }, "image/png");
  }

  function stopRecording() {
    if (recordingTimer) {
      clearTimeout(recordingTimer);
      recordingTimer = null;
    }
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function startRecording() {
    if (recorder && recorder.state === "recording") {
      stopRecording();
      return;
    }

    if (!canvas.captureStream || typeof MediaRecorder === "undefined") {
      ui.captureStatus.textContent = "WEBM recording is unavailable in this browser.";
      return;
    }

    recordedChunks = [];
    const stream = canvas.captureStream(60);
    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm"
    ];
    const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    });

    recorder.addEventListener("stop", () => {
      const blob = new Blob(recordedChunks, { type: recorder.mimeType || "video/webm" });
      if (blob.size > 0) {
        downloadBlob(blob, `coin-paradox-${timestampSlug()}.webm`);
        ui.captureStatus.textContent = "WEBM recording saved locally.";
      } else {
        ui.captureStatus.textContent = "Recording ended without video data.";
      }
      ui.recordingBadge.hidden = true;
      ui.record.textContent = "Record .WEBM";
      stream.getTracks().forEach((track) => track.stop());
      recorder = null;
    });

    recorder.start(250);
    recordingStartedAt = performance.now();
    ui.recordingBadge.hidden = false;
    ui.recordingBadge.textContent = "REC 00:00";
    ui.record.textContent = "Stop recording";
    ui.captureStatus.textContent = "Recording locally; automatic stop at 30 seconds.";
    recordingTimer = setTimeout(stopRecording, 30000);
  }

  function exportState() {
    const payload = {
      schema: "qsol-coin-paradox-state/v1",
      version: Core.VERSION,
      exportedAt: new Date().toISOString(),
      settings: state
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
      type: "application/json"
    });
    downloadBlob(blob, `coin-paradox-settings-${timestampSlug()}.json`);
    ui.captureStatus.textContent = "Settings JSON saved locally.";
  }

  async function importState(file) {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const settings = payload && payload.settings ? payload.settings : payload;
      activePreset = "";
      applyState(settings);
      ui.captureStatus.textContent = "Settings loaded from local JSON.";
    } catch (error) {
      ui.captureStatus.textContent = `Could not load settings: ${error.message}`;
    } finally {
      ui.importState.value = "";
    }
  }

  function applyPreset(name) {
    const preset = presets[name];
    if (!preset) {
      return;
    }
    activePreset = name;
    state = Core.normalizeSettings({
      ...state,
      ...preset,
      orbitAngle: 0
    });
    setPlaying(true);
    syncControls();
    updateReadout();
  }

  Object.values(controls).forEach((control) => {
    control.addEventListener("input", readControls);
    control.addEventListener("change", readControls);
  });

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => applyPreset(button.dataset.preset));
  });

  ui.playToggle.addEventListener("click", () => setPlaying(!playing));

  ui.resetOrbit.addEventListener("click", () => {
    state.orbitAngle = 0;
    setPlaying(false);
    syncControls();
    updateReadout();
  });

  ui.directionCCW.addEventListener("click", () => {
    state.direction = 1;
    syncControls();
    updateReadout();
  });

  ui.directionCW.addEventListener("click", () => {
    state.direction = -1;
    syncControls();
    updateReadout();
  });

  ui.placeAtContact.addEventListener("click", () => {
    state.markerRadius = 1;
    state.markerPhase = state.mode === "external" ? Math.PI : 0;
    activePreset = "";
    syncControls();
    updateReadout();
  });

  ui.snapshot.addEventListener("click", snapshot);
  ui.record.addEventListener("click", startRecording);
  ui.exportState.addEventListener("click", exportState);
  ui.importState.addEventListener("change", () => {
    const [file] = ui.importState.files;
    if (file) {
      importState(file);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !/^(INPUT|SELECT|BUTTON)$/.test(document.activeElement.tagName)) {
      event.preventDefault();
      setPlaying(!playing);
    }
  });

  const resizeObserver = new ResizeObserver(render);
  resizeObserver.observe(canvas);

  syncControls();
  updateReadout();
  requestAnimationFrame(updateAnimation);
})();
