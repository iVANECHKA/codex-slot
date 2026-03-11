import { gsap } from "gsap";
import { Application, BlurFilter, Container, Graphics, Sprite } from "pixi.js";
import {
  ROYAL_HEIST_PAYLINES_20,
  SLOT_SYMBOLS,
  type SlotLineWin,
  type SlotSpinOutcome,
  type SlotSymbolCode,
  type WinTier,
} from "@/lib/slots/demo-engine";
import { createSlotTextureAtlas, type SlotTextureAtlas } from "@/lib/slots/symbol-spritesheet";

interface SlotCell {
  container: Container;
  baseSprite: Sprite;
  shineSprite: Sprite;
  sparkleSprite: Sprite;
  rowIndex: number;
  baseY: number;
  symbol: SlotSymbolCode;
}

interface ReelView {
  container: Container;
  blurFilter: BlurFilter;
  cells: SlotCell[];
  running: boolean;
  elapsedMs: number;
  cycleIntervalMs: number;
  bounceTween?: gsap.core.Tween;
  reelIndex: number;
}

interface BoardMetrics {
  frameX: number;
  frameY: number;
  frameWidth: number;
  frameHeight: number;
  reelWidth: number;
  rowHeight: number;
  cellSize: number;
}

export interface SlotPixiSceneCallbacks {
  onSpinStart?: () => void;
  onReelStop?: (reelIndex: number) => void;
  onSpinEnd?: (outcome: SlotSpinOutcome) => void;
}

const PAYLINE_COLORS = [0xffd166, 0x00e5ff, 0xff7eb6, 0x85ffc7, 0xff9f1c, 0xa0c4ff, 0xf4a261, 0xcaffbf];

function randomSymbol(): SlotSymbolCode {
  const index = Math.floor(Math.random() * SLOT_SYMBOLS.length);
  return SLOT_SYMBOLS[index];
}

function tierCoinCount(tier: WinTier) {
  if (tier === "mega") {
    return 90;
  }
  if (tier === "big") {
    return 45;
  }
  if (tier === "small") {
    return 20;
  }
  return 0;
}

export class SlotPixiScene {
  private readonly host: HTMLElement;
  private readonly callbacks: SlotPixiSceneCallbacks;

  private app: Application | null = null;
  private atlas: SlotTextureAtlas | null = null;

  private stageRoot = new Container();
  private reelMask = new Graphics();
  private frameGlow = new Graphics();
  private frame = new Graphics();
  private reelViewport = new Container();
  private paylinesLayer = new Graphics();
  private fxLayer = new Container();
  private flashLayer = new Graphics();
  private frameGlowBlur = new BlurFilter({ strength: 4, quality: 1 });

  private reels: ReelView[] = [];
  private boardMetrics: BoardMetrics = {
    frameX: 0,
    frameY: 0,
    frameWidth: 0,
    frameHeight: 0,
    reelWidth: 0,
    rowHeight: 0,
    cellSize: 0,
  };

  private resizeObserver: ResizeObserver | null = null;
  private winPulseTween: gsap.core.Tween | null = null;
  private spinInProgress = false;
  private idleTime = 0;
  private destroyed = false;
  private activePaylineIndexes: number[] = [];

  private constructor(host: HTMLElement, callbacks?: SlotPixiSceneCallbacks) {
    this.host = host;
    this.callbacks = callbacks ?? {};
  }

  static async create(host: HTMLElement, callbacks?: SlotPixiSceneCallbacks) {
    const scene = new SlotPixiScene(host, callbacks);
    await scene.init();
    return scene;
  }

  private async init() {
    this.app = new Application();
    await this.app.init({
      resizeTo: this.host,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      backgroundAlpha: 0,
    });

    this.host.innerHTML = "";
    this.host.appendChild(this.app.canvas);

    this.atlas = createSlotTextureAtlas();
    this.buildScene();
    this.layout();

    this.app.ticker.add(this.tick);

    this.resizeObserver = new ResizeObserver(() => {
      this.layout();
    });
    this.resizeObserver.observe(this.host);
  }

  private buildScene() {
    if (!this.app || !this.atlas) {
      return;
    }

    this.app.stage.addChild(this.stageRoot);

    this.stageRoot.addChild(this.frameGlow);
    this.stageRoot.addChild(this.frame);
    this.stageRoot.addChild(this.reelMask);

    this.reelViewport.mask = this.reelMask;
    this.stageRoot.addChild(this.reelViewport);
    this.stageRoot.addChild(this.paylinesLayer);

    this.frameGlow.filters = [this.frameGlowBlur];

    this.fxLayer.eventMode = "none";
    this.stageRoot.addChild(this.fxLayer);

    this.flashLayer.eventMode = "none";
    this.flashLayer.alpha = 0;
    this.stageRoot.addChild(this.flashLayer);

    for (let reelIndex = 0; reelIndex < 5; reelIndex += 1) {
      const container = new Container();
      const blurFilter = new BlurFilter({ strengthY: 0, quality: 1, strengthX: 0 });
      container.filters = [blurFilter];

      const cells: SlotCell[] = [];
      for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
        const cellContainer = new Container();
        const baseSprite = new Sprite(this.atlas.symbols.gem.base);
        const shineSprite = new Sprite(this.atlas.symbols.gem.shine);
        const sparkleSprite = new Sprite(this.atlas.sparkle);

        [baseSprite, shineSprite, sparkleSprite].forEach((sprite) => {
          sprite.anchor.set(0.5);
          cellContainer.addChild(sprite);
        });

        shineSprite.alpha = 0.28;
        sparkleSprite.alpha = 0;
        sparkleSprite.blendMode = "add";

        container.addChild(cellContainer);

        cells.push({
          container: cellContainer,
          baseSprite,
          shineSprite,
          sparkleSprite,
          rowIndex,
          baseY: 0,
          symbol: "gem",
        });
      }

      this.reelViewport.addChild(container);
      this.reels.push({
        container,
        blurFilter,
        cells,
        running: false,
        elapsedMs: 0,
        cycleIntervalMs: 60 + reelIndex * 10,
        reelIndex,
      });
    }
  }

  private tick = ({ deltaMS }: { deltaMS: number }) => {
    if (this.destroyed) {
      return;
    }

    this.idleTime += deltaMS;

    this.reels.forEach((reel) => {
      if (reel.running) {
        reel.elapsedMs += deltaMS;
        if (reel.elapsedMs >= reel.cycleIntervalMs) {
          reel.elapsedMs = 0;
          reel.cells.forEach((cell) => {
            this.setCellSymbol(cell, randomSymbol());
            gsap.fromTo(
              cell.container,
              { y: cell.baseY - 14 },
              { y: cell.baseY, duration: 0.17, ease: "sine.out", overwrite: true },
            );
          });
        }
      } else {
        reel.cells.forEach((cell) => {
          if (this.spinInProgress) {
            return;
          }

          const idleWave = Math.sin(this.idleTime * 0.002 + reel.reelIndex * 0.7 + cell.rowIndex * 0.9);
          cell.shineSprite.alpha = 0.24 + idleWave * 0.11;
        });
      }
    });
  };

  private setCellSymbol(cell: SlotCell, symbol: SlotSymbolCode) {
    if (!this.atlas) {
      return;
    }

    const textures = this.atlas.symbols[symbol];
    cell.baseSprite.texture = textures.base;
    cell.shineSprite.texture = textures.shine;
    cell.symbol = symbol;
  }

  setGrid(grid: SlotSymbolCode[][]) {
    this.reels.forEach((reel, reelIndex) => {
      reel.cells.forEach((cell, rowIndex) => {
        this.setCellSymbol(cell, grid[rowIndex][reelIndex]);
      });
    });
  }

  private layout() {
    if (!this.app) {
      return;
    }

    const width = this.app.screen.width;
    const height = this.app.screen.height;

    const frameWidth = Math.min(width * 0.94, 980);
    const frameHeight = Math.min(height * 0.86, frameWidth * 0.66);
    const frameX = (width - frameWidth) / 2;
    const frameY = (height - frameHeight) / 2;

    const reelWidth = frameWidth / 5;
    const rowHeight = frameHeight / 3;
    const cellSize = Math.min(reelWidth * 0.84, rowHeight * 0.82);

    this.boardMetrics = {
      frameX,
      frameY,
      frameWidth,
      frameHeight,
      reelWidth,
      rowHeight,
      cellSize,
    };

    this.frameGlow.clear();
    this.frameGlow.lineStyle(6, 0x12f7ff, 0.4);
    this.frameGlow.drawRoundedRect(frameX - 4, frameY - 4, frameWidth + 8, frameHeight + 8, 30);

    this.frame.clear();
    this.frame.beginFill(0x150b34, 0.48);
    this.frame.drawRoundedRect(frameX - 2, frameY - 2, frameWidth + 4, frameHeight + 4, 28);
    this.frame.endFill();
    this.frame.lineStyle(4, 0xffd166, 0.9);
    this.frame.drawRoundedRect(frameX, frameY, frameWidth, frameHeight, 24);

    this.reelMask.clear();
    this.reelMask.beginFill(0xffffff);
    this.reelMask.drawRoundedRect(frameX + 2, frameY + 2, frameWidth - 4, frameHeight - 4, 20);
    this.reelMask.endFill();

    this.reelViewport.position.set(frameX, frameY);

    this.reels.forEach((reel, reelIndex) => {
      reel.container.position.set(reelWidth * reelIndex + reelWidth * 0.5, 0);

      reel.cells.forEach((cell, rowIndex) => {
        const y = rowHeight * rowIndex + rowHeight * 0.5;
        cell.baseY = y;
        cell.container.position.set(0, y);

        const scale = cellSize / cell.baseSprite.texture.width;
        cell.baseSprite.scale.set(scale);
        cell.shineSprite.scale.set(scale);
        cell.sparkleSprite.scale.set(scale * 0.95);
      });
    });

    this.flashLayer.clear();
    this.flashLayer.beginFill(0xffffff);
    this.flashLayer.drawRect(0, 0, width, height);
    this.flashLayer.endFill();

    if (this.activePaylineIndexes.length > 0) {
      this.drawWinningLines(this.activePaylineIndexes);
    }
  }

  private pointForCell(reelIndex: number, rowIndex: number) {
    const { frameX, frameY, reelWidth, rowHeight } = this.boardMetrics;
    return {
      x: frameX + reelWidth * reelIndex + reelWidth * 0.5,
      y: frameY + rowHeight * rowIndex + rowHeight * 0.5,
    };
  }

  private drawWinningLines(lineIndexes: number[]) {
    this.paylinesLayer.clear();

    lineIndexes.forEach((lineIndex, visibleIndex) => {
      const line = ROYAL_HEIST_PAYLINES_20[lineIndex];
      if (!line) {
        return;
      }

      this.paylinesLayer.lineStyle(3, PAYLINE_COLORS[visibleIndex % PAYLINE_COLORS.length], 0.95);
      line.forEach((row, reel) => {
        const point = this.pointForCell(reel, row);
        if (reel === 0) {
          this.paylinesLayer.moveTo(point.x, point.y);
          return;
        }
        this.paylinesLayer.lineTo(point.x, point.y);
      });
    });
  }

  private clearWinEffects() {
    this.activePaylineIndexes = [];
    this.paylinesLayer.clear();
    this.paylinesLayer.alpha = 0;

    this.winPulseTween?.kill();
    this.winPulseTween = null;

    this.fxLayer.removeChildren().forEach((child) => {
      gsap.killTweensOf(child);
      child.destroy();
    });

    this.reels.forEach((reel) => {
      reel.cells.forEach((cell) => {
        gsap.killTweensOf(cell.container);
        gsap.killTweensOf(cell.container.scale);
        gsap.killTweensOf(cell.shineSprite);
        gsap.killTweensOf(cell.sparkleSprite);
        cell.container.scale.set(1);
        cell.container.rotation = 0;
        cell.sparkleSprite.alpha = 0;
      });
    });
  }

  private animateWinningSymbols(lineWins: SlotLineWin[]) {
    const keySet = new Set<string>();

    lineWins.forEach((lineWin) => {
      lineWin.positions.forEach((position) => {
        keySet.add(`${position.reel}-${position.row}`);
      });
    });

    keySet.forEach((key) => {
      const [reelValue, rowValue] = key.split("-");
      const reelIndex = Number(reelValue);
      const rowIndex = Number(rowValue);
      const reel = this.reels[reelIndex];
      const cell = reel?.cells[rowIndex];

      if (!reel || !cell) {
        return;
      }

      gsap.to(cell.container.scale, {
        x: 1.12,
        y: 1.12,
        duration: 0.24,
        ease: "sine.inOut",
        yoyo: true,
        repeat: 5,
      });

      gsap.to(cell.shineSprite, {
        alpha: 0.95,
        duration: 0.18,
        ease: "power2.out",
        yoyo: true,
        repeat: 7,
      });

      gsap.to(cell.sparkleSprite, {
        alpha: 0.8,
        duration: 0.24,
        ease: "power2.out",
        yoyo: true,
        repeat: 5,
      });
    });
  }

  private spawnCoinRain(tier: WinTier) {
    if (!this.atlas || tier === "none") {
      return;
    }

    const count = tierCoinCount(tier);
    const { frameX, frameY, frameWidth, frameHeight } = this.boardMetrics;

    for (let index = 0; index < count; index += 1) {
      const coin = new Sprite(this.atlas.coin);
      coin.anchor.set(0.5);
      coin.scale.set(0.18 + Math.random() * 0.2);
      coin.blendMode = "add";

      coin.x = frameX + Math.random() * frameWidth;
      coin.y = frameY - 30 - Math.random() * 220;
      coin.alpha = 0.8;

      this.fxLayer.addChild(coin);

      gsap.to(coin, {
        y: frameY + frameHeight + 150,
        x: coin.x + (Math.random() - 0.5) * 90,
        rotation: (Math.random() - 0.5) * 4,
        alpha: 0.25,
        duration: 1.6 + Math.random() * 1.1,
        ease: "power2.in",
        delay: Math.random() * 0.5,
        onComplete: () => {
          coin.destroy();
        },
      });
    }
  }

  private playFlash(intensity: number) {
    gsap.killTweensOf(this.flashLayer);
    this.flashLayer.alpha = 0;
    gsap.to(this.flashLayer, {
      alpha: intensity,
      duration: 0.12,
      ease: "power2.out",
      yoyo: true,
      repeat: 1,
    });
  }

  private playScreenShake(strength: number) {
    const startX = this.stageRoot.x;
    const startY = this.stageRoot.y;

    gsap.to(this.stageRoot, {
      x: startX + strength,
      y: startY - strength * 0.8,
      duration: 0.05,
      yoyo: true,
      repeat: 7,
      ease: "sine.inOut",
      onUpdate: () => {
        this.stageRoot.x = startX + (Math.random() - 0.5) * strength;
        this.stageRoot.y = startY + (Math.random() - 0.5) * strength;
      },
      onComplete: () => {
        this.stageRoot.position.set(startX, startY);
      },
    });
  }

  private presentWin(outcome: SlotSpinOutcome) {
    const winningLines = [...new Set(outcome.lineWins.map((lineWin) => lineWin.lineIndex))];

    if (winningLines.length > 0) {
      this.activePaylineIndexes = winningLines;
      this.drawWinningLines(winningLines);
      this.paylinesLayer.alpha = 0.95;
      this.winPulseTween = gsap.to(this.paylinesLayer, {
        alpha: 0.2,
        duration: 0.4,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
      this.animateWinningSymbols(outcome.lineWins);
    }

    if (outcome.tier === "small") {
      this.playFlash(0.2);
    }

    if (outcome.tier === "big") {
      this.playFlash(0.35);
      this.spawnCoinRain("big");
      this.playScreenShake(6);
    }

    if (outcome.tier === "mega") {
      this.playFlash(0.55);
      this.spawnCoinRain("mega");
      this.playScreenShake(11);
    }
  }

  private stopReel(reel: ReelView, finalColumn: SlotSymbolCode[], resolve: () => void) {
    reel.running = false;
    reel.bounceTween?.kill();

    gsap.to(reel.blurFilter, {
      strengthY: 0,
      duration: 0.32,
      ease: "expo.out",
    });

    reel.cells.forEach((cell, rowIndex) => {
      this.setCellSymbol(cell, finalColumn[rowIndex]);
      gsap.fromTo(
        cell.container,
        { y: cell.baseY - 26 },
        {
          y: cell.baseY,
          duration: 0.42,
          ease: "bounce.out",
          delay: rowIndex * 0.03,
          overwrite: true,
        },
      );
    });

    gsap.to(reel.container, {
      y: 0,
      duration: 0.24,
      ease: "power2.out",
      overwrite: true,
    });

    this.callbacks.onReelStop?.(reel.reelIndex);
    window.setTimeout(resolve, 360);
  }

  async spin(outcome: SlotSpinOutcome) {
    if (this.spinInProgress || this.destroyed) {
      return;
    }

    this.spinInProgress = true;
    this.clearWinEffects();
    this.callbacks.onSpinStart?.();

    this.reels.forEach((reel) => {
      reel.running = true;
      reel.elapsedMs = 0;
      gsap.killTweensOf(reel.blurFilter);
      gsap.to(reel.blurFilter, {
        strengthY: 11,
        duration: 0.18,
        ease: "power2.out",
      });

      reel.bounceTween?.kill();
      reel.bounceTween = gsap.to(reel.container, {
        y: -6,
        duration: 0.16,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    });

    await Promise.all(
      this.reels.map(
        (reel, reelIndex) =>
          new Promise<void>((resolve) => {
            gsap.delayedCall(1 + reelIndex * 0.24, () => {
              const finalColumn = outcome.grid.map((row) => row[reelIndex]);
              this.stopReel(reel, finalColumn, resolve);
            });
          }),
      ),
    );

    this.spinInProgress = false;

    if (outcome.payout > 0 || outcome.scatterCount >= 3) {
      this.presentWin(outcome);
    }

    this.callbacks.onSpinEnd?.(outcome);
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.app) {
      this.app.ticker.remove(this.tick);
    }

    this.clearWinEffects();

    this.reels.forEach((reel) => {
      reel.bounceTween?.kill();
      reel.bounceTween = undefined;
      reel.container.destroy({ children: true });
    });
    this.reels = [];

    this.atlas?.destroy();
    this.atlas = null;

    this.frameGlowBlur.destroy();

    this.app?.destroy(true, { children: true, texture: true, textureSource: true });
    this.app = null;

    this.host.innerHTML = "";
  }
}
