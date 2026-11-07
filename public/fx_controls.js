export function applySingleFxRuntime(deps, color, fx, x, y, phaseOffset) {
  const { clamp01, getBeatPosition } = deps;
  if (!fx || !(fx.flash || fx.hold) || fx.mode === "none" || fx.amount <= 0) return color;

  const beat = getBeatPosition();
  const speed = 0.5 + fx.rate * 3;
  const amount = clamp01(fx.amount * 1.35);
  let factor = 1;

  if (fx.mode === "pulse") {
    factor = 1 - amount * 0.55 + Math.max(0, Math.sin(beat * speed + phaseOffset)) * amount * 0.75;
  } else if (fx.mode === "strobe") {
    factor = Math.sin(beat * speed * 4) > 0.2 ? 1 : 1 - amount;
  } else if (fx.mode === "shimmer") {
    const shimmer = Math.sin((x * 12.9898 + y * 78.233 + beat * speed * 8) * 0.35);
    factor = 1 - amount * 0.35 + Math.max(0, shimmer) * amount * 0.55;
  } else if (fx.mode === "spark") {
    const sparkle = Math.sin(x * 39.17 + y * 17.41 + Math.floor(beat * speed * 12) * 3.91);
    factor = sparkle > 0.72 ? 1 + amount * 1.8 : 1 - amount * 0.18;
  } else if (fx.mode === "gate") {
    factor = Math.floor(beat * speed * 2 + phaseOffset) % 2 === 0 ? 1 : 1 - amount;
  } else if (fx.mode === "wave") {
    const wave = Math.sin(x * 0.55 + y * 0.3 - beat * speed * 2);
    factor = 1 - amount * 0.35 + (wave * 0.5 + 0.5) * amount * 0.85;
  } else if (fx.mode === "crush") {
    const levels = Math.max(2, Math.round(16 - amount * 13));
    return [
      Math.round(color[0] / 255 * levels) / levels * 255,
      Math.round(color[1] / 255 * levels) / levels * 255,
      Math.round(color[2] / 255 * levels) / levels * 255
    ];
  } else if (fx.mode === "invert") {
    const keep = 1 - amount;
    return [
      color[0] * keep + (255 - color[0]) * amount,
      color[1] * keep + (255 - color[1]) * amount,
      color[2] * keep + (255 - color[2]) * amount
    ];
  } else if (fx.mode === "strobeGate") {
    factor = Math.floor(beat * speed * 6 + phaseOffset) % 3 === 0 ? 1 : 1 - amount;
  } else if (fx.mode === "beatCut") {
    factor = Math.floor(beat * speed + phaseOffset) % 2 === 0 ? 1 : 1 - amount;
  } else if (fx.mode === "glitchMix") {
    const shift = Math.floor(Math.abs(Math.sin(beat * speed * 11 + x)) * 3);
    const keep = 1 - amount * 0.4;
    const mix = amount * 0.8;
    return [
      color[0] * keep + color[(shift) % 3] * mix,
      color[1] * keep + color[(1 + shift) % 3] * mix,
      color[2] * keep + color[(2 + shift) % 3] * mix
    ];
  }

  return [
    color[0] * factor,
    color[1] * factor,
    color[2] * factor
  ];
}

export function blendWithModeRuntime(deps, a, b, mode) {
  const { clamp01, getBeatPosition, state } = deps;
  const beat = getBeatPosition();
  switch (mode) {
    case "fade":
    case "add":
      return [Math.min(255, a[0] + b[0]), Math.min(255, a[1] + b[1]), Math.min(255, a[2] + b[2])];
    case "screen":
      return [255 - ((255 - a[0]) * (255 - b[0])) / 255, 255 - ((255 - a[1]) * (255 - b[1])) / 255, 255 - ((255 - a[2]) * (255 - b[2])) / 255];
    case "multiply":
      return [(a[0] * b[0]) / 255, (a[1] * b[1]) / 255, (a[2] * b[2]) / 255];
    case "mix":
      return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
    case "max":
    case "lighten":
      return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
    case "overlay":
      return [
        a[0] < 128 ? (2 * a[0] * b[0]) / 255 : 255 - (2 * (255 - a[0]) * (255 - b[0])) / 255,
        a[1] < 128 ? (2 * a[1] * b[1]) / 255 : 255 - (2 * (255 - a[1]) * (255 - b[1])) / 255,
        a[2] < 128 ? (2 * a[2] * b[2]) / 255 : 255 - (2 * (255 - a[2]) * (255 - b[2])) / 255
      ];
    case "darken":
      return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
    case "difference":
      return [Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])];
    case "colorDodge":
      return [
        b[0] >= 255 ? 255 : Math.min(255, (a[0] * 255) / (255 - b[0])),
        b[1] >= 255 ? 255 : Math.min(255, (a[1] * 255) / (255 - b[1])),
        b[2] >= 255 ? 255 : Math.min(255, (a[2] * 255) / (255 - b[2]))
      ];
    case "lumaMask": {
      const luma = clamp01((b[0] * 0.2126 + b[1] * 0.7152 + b[2] * 0.0722) / 255);
      const keep = 1 - luma;
      return [
        a[0] * keep + b[0] * luma,
        a[1] * keep + b[1] * luma,
        a[2] * keep + b[2] * luma
      ];
    }
    case "strobeGate":
      return Math.floor(beat * 4) % 2 === 0 ? a : b;
    case "beatCut":
      return Math.floor(beat) % 2 === 0 ? a : b;
    case "glitchMix": {
      const gate = Math.sin(Math.floor(beat * 8) * 12.9898) > 0 ? 1 : 0;
      return gate
        ? [Math.abs(a[0] - b[1]), Math.abs(a[1] - b[2]), Math.abs(a[2] - b[0])]
        : [Math.min(255, a[0] + b[0] * 0.7), Math.min(255, a[1] + b[1] * 0.7), Math.min(255, a[2] + b[2] * 0.7)];
    }
    case "subtract":
      return [Math.max(0, a[0] - b[0]), Math.max(0, a[1] - b[1]), Math.max(0, a[2] - b[2])];
    case "softlight":
      return [
        softlightChannel(a[0], b[0]),
        softlightChannel(a[1], b[1]),
        softlightChannel(a[2], b[2])
      ];
    default:
      return [Math.min(a[0] + b[0], 255), Math.min(a[1] + b[1], 255), Math.min(a[2] + b[2], 255)];
  }
}

export function blendRuntime(deps, a, b) {
  const { transitions, transitionProgress, easeInOut, blendWithMode, mixColor, state } = deps;
  const transition = transitions.blend;
  if (transition) {
    const progress = transitionProgress(transition);
    if (progress < 1) {
      return mixColor(
        blendWithMode(a, b, transition.mode),
        blendWithMode(a, b, state.blendMode),
        easeInOut(progress)
      );
    }
  }
  return blendWithMode(a, b, state.blendMode);
}

function softlightChannel(baseValue, topValue) {
  const base = baseValue / 255;
  const top = topValue / 255;
  const mixed = top < 0.5
    ? base - (1 - 2 * top) * base * (1 - base)
    : base + (2 * top - 1) * (Math.sqrt(base) - base);
  return mixed * 255;
}
