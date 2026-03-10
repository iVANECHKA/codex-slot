import type { GameDefinition, SlotGameDefinition, SlotMathModel } from "@/lib/casino/types";

const paylines = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
];

type SlotOverrides = Omit<SlotGameDefinition, "kind" | "config"> & {
  config?: Partial<SlotMathModel>;
};

export const gameKindLabels = {
  slot: "Слот",
  crash: "Краш",
  mines: "Мины",
} as const;

function buildSlot(config: SlotOverrides): SlotGameDefinition {
  return {
    kind: "slot",
    ...config,
    config: {
      type: "slot",
      rows: 3,
      paylines,
      rtpTarget: 96.1,
      volatility: "high",
      minBet: 10,
      maxBet: 500,
      bonusBuy: {
        featureKey: "freespins",
        priceMultiplier: 80,
        minMultiplier: 12,
        maxMultiplier: 180,
      },
      symbols: [
        { code: "W", label: "Вайлд", accent: "from-amber-300 to-orange-500", wild: true, payouts: { 3: 10, 4: 25, 5: 75 } },
        { code: "S", label: "Скаттер", accent: "from-fuchsia-400 to-rose-500", scatter: true },
        { code: "A", label: "Туз", accent: "from-sky-400 to-cyan-500", payouts: { 3: 3, 4: 8, 5: 18 } },
        { code: "K", label: "Король", accent: "from-violet-400 to-indigo-500", payouts: { 3: 3, 4: 7, 5: 15 } },
        { code: "Q", label: "Дама", accent: "from-emerald-400 to-green-500", payouts: { 3: 2, 4: 6, 5: 12 } },
        { code: "J", label: "Валет", accent: "from-pink-400 to-rose-400", payouts: { 3: 2, 4: 5, 5: 10 } },
      ],
      reels: [
        ["A", "K", "Q", "J", "W", "A", "Q", "S", "J", "K", "A", "Q", "W", "J", "K"],
        ["Q", "J", "A", "K", "S", "Q", "W", "J", "A", "K", "Q", "J", "A", "W", "K"],
        ["K", "A", "Q", "W", "J", "S", "K", "Q", "A", "J", "K", "W", "Q", "A", "J"],
        ["J", "Q", "K", "A", "W", "J", "S", "Q", "K", "A", "J", "Q", "W", "K", "A"],
        ["A", "W", "Q", "J", "K", "A", "S", "Q", "J", "K", "A", "Q", "W", "J", "K"],
      ],
      ...(config.config ?? {}),
    },
  };
}

export const gameCatalog: GameDefinition[] = [
  buildSlot({
    slug: "royal-heist",
    title: "Королевское ограбление",
    subtitle: "Бархатный слот с резкими пиками и дорогой покупкой бонуски.",
    description: "Пять барабанов, премиальные символы, классические линии выплат и насыщенная бонусная фича.",
    accent: "from-amber-300 via-orange-500 to-rose-500",
    eyebrow: "Премиум слот",
    thumbnail: "Золотые карты и зеркальный хром.",
    hero: "Высоковолатильный слот в эстетике дорогого казино и пентхаусных ограблений.",
  }),
  buildSlot({
    slug: "neon-comet",
    title: "Неоновая комета",
    subtitle: "Быстрый synthwave-слот с более частыми попаданиями по линиям.",
    description: "Более яркий слот-профиль со взрывными вайлдами и бодрой бонусной кривой.",
    accent: "from-cyan-400 via-sky-500 to-fuchsia-500",
    eyebrow: "Аркадный слот",
    thumbnail: "Хром, неоновая дымка и огни трассы.",
    hero: "Современный слот с быстрым темпом и более частыми сериями игры.",
    config: {
      volatility: "medium",
      rtpTarget: 95.8,
      bonusBuy: {
        featureKey: "freespins",
        priceMultiplier: 65,
        minMultiplier: 10,
        maxMultiplier: 140,
      },
    },
  }),
  buildSlot({
    slug: "sunset-scarabs",
    title: "Скарабеи заката",
    subtitle: "Древнее золото, медленнее ритм барабанов и более глубокий бонусный потолок.",
    description: "Пустынная палитра, тяжелее волатильность и более драматичный бонусный диапазон.",
    accent: "from-yellow-300 via-amber-500 to-lime-400",
    eyebrow: "Приключенческий слот",
    thumbnail: "Храмовый песчаник, лаковый металл и искры песка.",
    hero: "Статусный слот с широким разбросом выплат и запасом под крупные бонусные заносы.",
    config: {
      volatility: "very_high",
      rtpTarget: 96.2,
      bonusBuy: {
        featureKey: "freespins",
        priceMultiplier: 90,
        minMultiplier: 15,
        maxMultiplier: 220,
      },
    },
  }),
  {
    slug: "rocket-x",
    title: "Rocket X",
    subtitle: "Сольные краш-сессии с настраиваемым edge и авто-выводом.",
    description: "Личный запуск, где кривая рассчитывается на сервере до старта каждого раунда.",
    accent: "from-rose-400 via-orange-500 to-amber-300",
    eyebrow: "Краш",
    thumbnail: "Сопло двигателя, жар и полетный UI.",
    hero: "Каждый раунд использует детерминированный seed, потолок множителя и изолированный расчет результата.",
    kind: "crash",
    config: {
      type: "crash",
      houseEdge: 0.04,
      growthFactor: 0.82,
      minBet: 10,
      maxBet: 500,
      maxMultiplier: 250,
    },
  },
  {
    slug: "vault-mines",
    title: "Мины хранилища",
    subtitle: "Мины в стиле казино с серверным полем и прогрессивными множителями.",
    description: "Открывай клетки на поле 5x5, собирай безопасную серию и выводи до попадания на мину.",
    accent: "from-emerald-300 via-teal-500 to-cyan-500",
    eyebrow: "Мины",
    thumbnail: "Плитка хранилища и тревожная подсветка.",
    hero: "Поле генерируется на каждый раунд и остается скрытым от клиента до вызовов API.",
    kind: "mines",
    config: {
      type: "mines",
      boardSize: 5,
      minMines: 3,
      maxMines: 12,
      houseEdge: 0.03,
      minBet: 10,
      maxBet: 500,
    },
  },
];

export function getGameBySlug(slug: string) {
  return gameCatalog.find((game) => game.slug === slug);
}

export function getFeaturedGames() {
  return gameCatalog.slice(0, 5);
}

export function getSlotGames() {
  return gameCatalog.filter((game) => game.kind === "slot");
}