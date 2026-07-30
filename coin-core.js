// SPDX-License-Identifier: MPL-2.0
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CoinCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const TAU = Math.PI * 2;
  const MODES = Object.freeze(["external", "internal"]);
  const VIEWS = Object.freeze(["comparison", "laboratory", "radial", "unwrapped", "curve"]);

  const DEFAULTS = Object.freeze({
    fixedRadius: 1,
    coinRadius: 1,
    mode: "external",
    orbitAngle: 0,
    markerRadius: 1,
    markerPhase: Math.PI,
    direction: 1,
    speed: 0.12,
    view: "comparison",
    showCurve: true,
    showCentrePath: true,
    showContact: true,
    showGrid: true,
    showLabels: true
  });

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value)));
  }

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function wrapAngle(angle) {
    const wrapped = finite(angle, 0) % TAU;
    return wrapped < 0 ? wrapped + TAU : wrapped;
  }

  function signedTurns(angle) {
    return finite(angle, 0) / TAU;
  }

  function normalizeSettings(input) {
    const source = input || {};
    const mode = MODES.includes(source.mode) ? source.mode : DEFAULTS.mode;
    const fixedRadius = clamp(finite(source.fixedRadius, DEFAULTS.fixedRadius), 0.25, 5);
    let coinRadius = clamp(finite(source.coinRadius, DEFAULTS.coinRadius), 0.1, 3);

    if (mode === "internal") {
      coinRadius = Math.min(coinRadius, Math.max(0.1, fixedRadius - 0.05));
    }

    return {
      fixedRadius,
      coinRadius,
      mode,
      orbitAngle: clamp(finite(source.orbitAngle, DEFAULTS.orbitAngle), 0, TAU),
      markerRadius: clamp(finite(source.markerRadius, DEFAULTS.markerRadius), 0, 1.5),
      markerPhase: wrapAngle(source.markerPhase ?? DEFAULTS.markerPhase),
      direction: Number(source.direction) < 0 ? -1 : 1,
      speed: clamp(finite(source.speed, DEFAULTS.speed), 0.01, 1.5),
      view: VIEWS.includes(source.view) ? source.view : DEFAULTS.view,
      showCurve: source.showCurve !== false,
      showCentrePath: source.showCentrePath !== false,
      showContact: source.showContact !== false,
      showGrid: source.showGrid !== false,
      showLabels: source.showLabels !== false
    };
  }

  function orbitRadius(settings) {
    const s = normalizeSettings(settings);
    return s.mode === "external"
      ? s.fixedRadius + s.coinRadius
      : s.fixedRadius - s.coinRadius;
  }

  function labRotationFactor(settings) {
    const s = normalizeSettings(settings);
    if (s.mode === "external") {
      return (s.fixedRadius + s.coinRadius) / s.coinRadius;
    }
    return -(s.fixedRadius - s.coinRadius) / s.coinRadius;
  }

  function radialRotationFactor(settings) {
    const s = normalizeSettings(settings);
    return labRotationFactor(s) - 1;
  }

  function boundaryRotationFactor(settings) {
    const s = normalizeSettings(settings);
    return s.mode === "external"
      ? s.fixedRadius / s.coinRadius
      : -s.fixedRadius / s.coinRadius;
  }

  function centreAt(settings, angle) {
    const s = normalizeSettings(settings);
    const alpha = finite(angle, s.orbitAngle);
    const radius = orbitRadius(s);
    return {
      x: radius * Math.cos(alpha),
      y: radius * Math.sin(alpha)
    };
  }

  function orientationAt(settings, angle) {
    const s = normalizeSettings(settings);
    return labRotationFactor(s) * finite(angle, s.orbitAngle);
  }

  function contactPoint(settings, angle) {
    const s = normalizeSettings(settings);
    const alpha = finite(angle, s.orbitAngle);
    return {
      x: s.fixedRadius * Math.cos(alpha),
      y: s.fixedRadius * Math.sin(alpha)
    };
  }

  function markerPoint(settings, angle, markerFraction, markerPhase) {
    const s = normalizeSettings(settings);
    const alpha = finite(angle, s.orbitAngle);
    const centre = centreAt(s, alpha);
    const orientation = orientationAt(s, alpha);
    const fraction = clamp(
      markerFraction === undefined ? s.markerRadius : markerFraction,
      0,
      1.5
    );
    const phase = markerPhase === undefined ? s.markerPhase : finite(markerPhase, s.markerPhase);
    const radius = s.coinRadius * fraction;
    return {
      x: centre.x + radius * Math.cos(orientation + phase),
      y: centre.y + radius * Math.sin(orientation + phase)
    };
  }

  function rotationsAt(settings, angle) {
    const s = normalizeSettings(settings);
    const alpha = finite(angle, s.orbitAngle);
    const labTurns = labRotationFactor(s) * alpha / TAU;
    const orbitTurns = alpha / TAU;
    const radialTurns = labTurns - orbitTurns;
    const boundaryTurns = boundaryRotationFactor(s) * alpha / TAU;
    return {
      labTurns,
      orbitTurns,
      radialTurns,
      boundaryTurns
    };
  }

  function fullOrbitSummary(settings) {
    const s = normalizeSettings(settings);
    const rotations = rotationsAt(s, TAU);
    const centrePathRadius = orbitRadius(s);
    const centrePathLength = TAU * centrePathRadius;
    const coinCircumference = TAU * s.coinRadius;
    const fixedCircumference = TAU * s.fixedRadius;
    return {
      ...rotations,
      fixedRadius: s.fixedRadius,
      coinRadius: s.coinRadius,
      centrePathRadius,
      centrePathLength,
      fixedCircumference,
      coinCircumference,
      centrePathRatio: centrePathLength / coinCircumference,
      boundaryRatio: fixedCircumference / coinCircumference
    };
  }

  function contactVelocity(settings, angle, angularSpeed) {
    const s = normalizeSettings(settings);
    const alpha = finite(angle, s.orbitAngle);
    const alphaDot = finite(angularSpeed, 1);
    const pathRadius = orbitRadius(s);
    const centreVelocity = {
      x: -pathRadius * Math.sin(alpha) * alphaDot,
      y: pathRadius * Math.cos(alpha) * alphaDot
    };
    const centre = centreAt(s, alpha);
    const contact = contactPoint(s, alpha);
    const rx = contact.x - centre.x;
    const ry = contact.y - centre.y;
    const omega = labRotationFactor(s) * alphaDot;
    const rotationalVelocity = {
      x: -omega * ry,
      y: omega * rx
    };
    const total = {
      x: centreVelocity.x + rotationalVelocity.x,
      y: centreVelocity.y + rotationalVelocity.y
    };
    return {
      centreVelocity,
      rotationalVelocity,
      total,
      error: Math.hypot(total.x, total.y)
    };
  }

  function sampleMarkerCurve(settings, endAngle, samples) {
    const s = normalizeSettings(settings);
    const count = Math.max(2, Math.floor(finite(samples, 360)));
    const finish = clamp(finite(endAngle, TAU), 0, TAU);
    const points = [];
    for (let index = 0; index <= count; index += 1) {
      const angle = finish * index / count;
      points.push(markerPoint(s, angle));
    }
    return points;
  }

  function transformPoint(point, angle) {
    const rotation = finite(angle, 0);
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    return {
      x: point.x * cosine - point.y * sine,
      y: point.x * sine + point.y * cosine
    };
  }

  function formula(settings) {
    const s = normalizeSettings(settings);
    if (s.mode === "external") {
      return {
        lab: "N_lab = (R + r) / r = R/r + 1",
        radial: "N_radial = R / r",
        centrePath: "C_center = 2π(R + r)"
      };
    }
    return {
      lab: "N_lab = −(R − r) / r = 1 − R/r",
      radial: "N_radial = −R / r",
      centrePath: "C_center = 2π(R − r)"
    };
  }

  return Object.freeze({
    VERSION,
    TAU,
    MODES,
    VIEWS,
    DEFAULTS,
    clamp,
    finite,
    wrapAngle,
    signedTurns,
    normalizeSettings,
    orbitRadius,
    labRotationFactor,
    radialRotationFactor,
    boundaryRotationFactor,
    centreAt,
    orientationAt,
    contactPoint,
    markerPoint,
    rotationsAt,
    fullOrbitSummary,
    contactVelocity,
    sampleMarkerCurve,
    transformPoint,
    formula
  });
});
