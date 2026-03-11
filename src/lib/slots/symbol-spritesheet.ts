import { Rectangle, Texture } from "pixi.js";
import type { SlotSymbolCode } from "@/lib/slots/demo-engine";

interface SymbolPalette {
  top: string;
  bottom: string;
  glow: string;
  stroke: string;
  glyph: string;
}

const SYMBOL_PALETTES: Record<SlotSymbolCode, SymbolPalette> = {
  gem: { top: "#40e0ff", bottom: "#0b6ab8", glow: "#75f8ff", stroke: "#b6f9ff", glyph: "GM" },
  crown: { top: "#fcd34d", bottom: "#b45309", glow: "#ffe283", stroke: "#fff0bb", glyph: "CR" },
  seven: { top: "#ff5d7d", bottom: "#cc153a", glow: "#ff98ad", stroke: "#ffd0dc", glyph: "7" },
  bar: { top: "#f5f5f5", bottom: "#8d9bb0", glow: "#ffffff", stroke: "#ffffff", glyph: "BAR" },
  star: { top: "#f9a8d4", bottom: "#b83280", glow: "#ffd2ec", stroke: "#ffe7f6", glyph: "ST" },
  scatter: { top: "#a78bfa", bottom: "#5b21b6", glow: "#d4c8ff", stroke: "#e9e3ff", glyph: "SC" },
  wild: { top: "#fb923c", bottom: "#9a3412", glow: "#ffd2a5", stroke: "#ffe7cf", glyph: "W" },
};

export interface SlotTextureAtlas {
  atlasTexture: Texture;
  symbols: Record<SlotSymbolCode, { base: Texture; shine: Texture }>;
  coin: Texture;
  sparkle: Texture;
  destroy: () => void;
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function drawStar(context: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) {
  const spikes = 5;
  const innerRadius = radius * 0.45;
  let rotation = -Math.PI / 2;

  context.beginPath();
  for (let index = 0; index < spikes; index += 1) {
    const outerX = centerX + Math.cos(rotation) * radius;
    const outerY = centerY + Math.sin(rotation) * radius;
    context.lineTo(outerX, outerY);
    rotation += Math.PI / spikes;

    const innerX = centerX + Math.cos(rotation) * innerRadius;
    const innerY = centerY + Math.sin(rotation) * innerRadius;
    context.lineTo(innerX, innerY);
    rotation += Math.PI / spikes;
  }
  context.closePath();
}

function drawCrown(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  context.beginPath();
  context.moveTo(x, y + height);
  context.lineTo(x + width * 0.12, y + height * 0.38);
  context.lineTo(x + width * 0.34, y + height * 0.62);
  context.lineTo(x + width * 0.5, y + height * 0.24);
  context.lineTo(x + width * 0.66, y + height * 0.62);
  context.lineTo(x + width * 0.88, y + height * 0.38);
  context.lineTo(x + width, y + height);
  context.closePath();
}

function drawSymbolGlyph(
  context: CanvasRenderingContext2D,
  symbol: SlotSymbolCode,
  centerX: number,
  centerY: number,
  scale: number,
) {
  context.save();
  context.translate(centerX, centerY);

  if (symbol === "gem") {
    context.beginPath();
    context.moveTo(0, -44 * scale);
    context.lineTo(36 * scale, -8 * scale);
    context.lineTo(0, 50 * scale);
    context.lineTo(-36 * scale, -8 * scale);
    context.closePath();
    context.fill();
  } else if (symbol === "crown") {
    drawCrown(context, -52 * scale, -44 * scale, 104 * scale, 88 * scale);
    context.fill();
  } else if (symbol === "star") {
    drawStar(context, 0, 0, 46 * scale);
    context.fill();
  } else if (symbol === "bar") {
    context.fillRect(-58 * scale, -10 * scale, 116 * scale, 22 * scale);
    context.fillRect(-58 * scale, -40 * scale, 116 * scale, 18 * scale);
    context.fillRect(-58 * scale, 22 * scale, 116 * scale, 18 * scale);
  } else {
    const glyph = SYMBOL_PALETTES[symbol].glyph;
    context.font = "900 56px \"Segoe UI\", \"Trebuchet MS\", sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(glyph, 0, 0);
  }

  context.restore();
}

function drawSymbolCard(
  context: CanvasRenderingContext2D,
  symbol: SlotSymbolCode,
  frameSize: number,
  offsetX: number,
  offsetY: number,
  shineVariant: boolean,
) {
  const palette = SYMBOL_PALETTES[symbol];
  const margin = 16;
  const width = frameSize - margin * 2;
  const height = frameSize - margin * 2;

  context.save();
  context.translate(offsetX, offsetY);

  roundedRectPath(context, margin, margin, width, height, 28);
  const gradient = context.createLinearGradient(margin, margin, margin, margin + height);
  gradient.addColorStop(0, palette.top);
  gradient.addColorStop(1, palette.bottom);
  context.fillStyle = gradient;
  context.fill();

  context.strokeStyle = shineVariant ? "#fff8d8" : palette.stroke;
  context.lineWidth = 5;
  context.stroke();

  const gloss = context.createLinearGradient(0, margin, 0, margin + height * 0.55);
  gloss.addColorStop(0, "rgba(255,255,255,0.45)");
  gloss.addColorStop(1, "rgba(255,255,255,0.02)");
  roundedRectPath(context, margin + 5, margin + 5, width - 10, height * 0.6, 24);
  context.fillStyle = gloss;
  context.fill();

  context.globalAlpha = shineVariant ? 0.38 : 0.2;
  const halo = context.createRadialGradient(
    frameSize * 0.5,
    frameSize * 0.45,
    10,
    frameSize * 0.5,
    frameSize * 0.45,
    frameSize * 0.5,
  );
  halo.addColorStop(0, palette.glow);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = halo;
  context.fillRect(0, 0, frameSize, frameSize);
  context.globalAlpha = 1;

  context.fillStyle = shineVariant ? "#fff7d1" : "rgba(255,255,255,0.95)";
  context.shadowColor = palette.glow;
  context.shadowBlur = shineVariant ? 24 : 12;
  drawSymbolGlyph(context, symbol, frameSize * 0.5, frameSize * 0.56, 1);

  context.restore();
}

function drawCoinTexture(context: CanvasRenderingContext2D, frameSize: number, offsetX: number, offsetY: number) {
  context.save();
  context.translate(offsetX, offsetY);

  const center = frameSize / 2;
  const outer = frameSize * 0.34;
  const ringGradient = context.createRadialGradient(center, center, outer * 0.2, center, center, outer);
  ringGradient.addColorStop(0, "#fff6b6");
  ringGradient.addColorStop(0.55, "#f8c74e");
  ringGradient.addColorStop(1, "#9e5a08");

  context.fillStyle = ringGradient;
  context.beginPath();
  context.arc(center, center, outer, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#ffe08a";
  context.lineWidth = 6;
  context.beginPath();
  context.arc(center, center, outer * 0.72, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "rgba(255,255,255,0.75)";
  context.font = '900 58px "Segoe UI", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("$", center, center + 2);

  context.restore();
}

function drawSparkleTexture(context: CanvasRenderingContext2D, frameSize: number, offsetX: number, offsetY: number) {
  context.save();
  context.translate(offsetX, offsetY);

  const center = frameSize / 2;
  const gradient = context.createRadialGradient(center, center, 6, center, center, frameSize * 0.42);
  gradient.addColorStop(0, "rgba(255,252,235,1)");
  gradient.addColorStop(0.6, "rgba(255,220,130,0.9)");
  gradient.addColorStop(1, "rgba(255,220,130,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, frameSize, frameSize);

  context.strokeStyle = "rgba(255,245,210,0.95)";
  context.lineWidth = 8;
  context.beginPath();
  context.moveTo(center, frameSize * 0.15);
  context.lineTo(center, frameSize * 0.85);
  context.moveTo(frameSize * 0.15, center);
  context.lineTo(frameSize * 0.85, center);
  context.stroke();

  context.restore();
}

export function createSlotTextureAtlas() {
  const frameSize = 192;
  const symbolCodes = Object.keys(SYMBOL_PALETTES) as SlotSymbolCode[];
  const atlasCols = symbolCodes.length + 2;
  const atlasRows = 2;

  const canvas = document.createElement("canvas");
  canvas.width = atlasCols * frameSize;
  canvas.height = atlasRows * frameSize;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create symbol spritesheet.");
  }

  symbolCodes.forEach((symbol, index) => {
    drawSymbolCard(context, symbol, frameSize, index * frameSize, 0, false);
    drawSymbolCard(context, symbol, frameSize, index * frameSize, frameSize, true);
  });

  const coinColumn = symbolCodes.length;
  const sparkleColumn = symbolCodes.length + 1;
  drawCoinTexture(context, frameSize, coinColumn * frameSize, 0);
  drawSparkleTexture(context, frameSize, sparkleColumn * frameSize, 0);
  drawSparkleTexture(context, frameSize, sparkleColumn * frameSize, frameSize);

  const atlasTexture = Texture.from(canvas);
  const source = atlasTexture.source;

  const symbols = symbolCodes.reduce((accumulator, symbol, index) => {
    accumulator[symbol] = {
      base: new Texture({ source, frame: new Rectangle(index * frameSize, 0, frameSize, frameSize) }),
      shine: new Texture({ source, frame: new Rectangle(index * frameSize, frameSize, frameSize, frameSize) }),
    };
    return accumulator;
  }, {} as Record<SlotSymbolCode, { base: Texture; shine: Texture }>);

  const coin = new Texture({ source, frame: new Rectangle(coinColumn * frameSize, 0, frameSize, frameSize) });
  const sparkle = new Texture({ source, frame: new Rectangle(sparkleColumn * frameSize, frameSize, frameSize, frameSize) });

  return {
    atlasTexture,
    symbols,
    coin,
    sparkle,
    destroy: () => {
      Object.values(symbols).forEach((symbolTextures) => {
        symbolTextures.base.destroy();
        symbolTextures.shine.destroy();
      });
      coin.destroy();
      sparkle.destroy();
      atlasTexture.destroy(true);
    },
  } satisfies SlotTextureAtlas;
}

