/**
 * Sticker catalogue + canvas drawing.
 *
 * Two kinds of sticker, because that is what people actually use today:
 *
 *  - **glyph**  — an emoji or character drawn as text.
 *  - **caption** — a short meme phrase rendered as a outlined sticker label
 *                  (the "文字贴纸" format that dominates current sticker packs:
 *                  the 背手负鼠 / 哭哭马 style of 2026).
 *
 * The catalogue is organised as **packs** — small themed sets of 6 — because
 * that is how sticker packs are actually consumed. Packs are curated from
 * what is genuinely trending right now rather than generic smiley faces.
 *
 * Sizing contract: both the canvas renderer and the React overlay derive glyph
 * size from `STICKER_FONT_RATIO`, so a sticker looks identical on screen and
 * in the exported print.
 */

/* -------------------------------------------------------------------------- */
/* Data model                                                                 */
/* -------------------------------------------------------------------------- */

/** What a sticker draws. */
export type StickerKind = 'glyph' | 'caption';

/** A single sticker placed on the sheet. */
export interface StickerItem {
  id: string;
  /** The glyph/emoji, or the phrase for caption stickers. */
  glyph: string;
  /** Normalised x position in the 0..1 range, relative to the canvas width. */
  x: number;
  /** Normalised y position in the 0..1 range, relative to the canvas height. */
  y: number;
  /** Size multiplier, 1 ≈ default size. */
  scale: number;
  /** Rotation in radians. */
  rotation: number;
  /** How to draw this sticker. Defaults to `glyph` for older saved data. */
  kind?: StickerKind;
  /** Caption stickers: bubble fill. */
  fill?: string;
  /** Caption stickers: outline colour. */
  stroke?: string;
  /** Caption stickers: text colour. */
  color?: string;
}

/** A picker tab — one sticker pack. */
export type StickerCategory =
  | 'fushu' // 背手负鼠 — the 2026 top meme
  | 'kukum' // 哭哭马 — 牛马 self-deprecation
  | 'huli' // 雪山狐狸 — AI short-video phenomenon
  | 'work' // 打工人日常
  | 'btsx' // 不烧心 — 2026 catchphrase
  | 'mood' // 情绪状态
  | 'deco' // 装饰符号
  | 'love' // 心动
  | 'text'; // 通用文字

/** A catalogue entry describing one pickable sticker. */
export interface StickerDef {
  id: string;
  /** The emoji / character / phrase to render. */
  glyph: string;
  /** Chinese label shown in the picker tooltip. */
  label: string;
  /** Which pack it lives under. */
  category: StickerCategory;
  /** Default relative size, e.g. `1.0`. */
  size: number;
  /** Draw as a caption bubble instead of a plain glyph. */
  kind?: StickerKind;
  /** Mark as currently trending — the picker shows a hot dot. */
  hot?: boolean;
  /** Caption bubble styling. */
  fill?: string;
  stroke?: string;
  color?: string;
}

/* -------------------------------------------------------------------------- */
/* Sizing contract (shared with the canvas renderer)                          */
/* -------------------------------------------------------------------------- */

/**
 * Glyph font size as a fraction of the sheet width, per unit of `scale`.
 *
 * `fontSize = scale * width * STICKER_FONT_RATIO` — a `scale` of `1` therefore
 * renders at 18% of the sheet width.
 */
export const STICKER_FONT_RATIO = 0.18;

/** Emoji-capable font stack, falling back to the OS emoji font. */
export const STICKER_FONT_STACK =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif';

/** Handwriting / display stack for caption stickers. */
export const STICKER_CAPTION_STACK =
  '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif';

/** Minimum / maximum scale a sticker may be resized to. */
export const STICKER_MIN_SCALE = 0.3;
export const STICKER_MAX_SCALE = 4.0;

/** Caption stickers are wider than they are tall, so they size off this ratio. */
export const CAPTION_FONT_RATIO = 0.082;

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

/** Picker tabs, in display order. */
export const STICKER_CATEGORIES: Array<{ id: StickerCategory; label: string }> = [
  { id: 'fushu', label: '负鼠' },
  { id: 'kukum', label: '哭哭马' },
  { id: 'btsx', label: '不烧心' },
  { id: 'huli', label: '雪山狐' },
  { id: 'work', label: '打工人' },
  { id: 'mood', label: '情绪' },
  { id: 'deco', label: '装饰' },
  { id: 'love', label: '心动' },
  { id: 'text', label: '文字' },
];

/** Shorthand for a caption sticker. */
const cap = (
  id: string,
  glyph: string,
  label: string,
  category: StickerCategory,
  opts: Partial<StickerDef> = {},
): StickerDef => ({
  id,
  glyph,
  label,
  category,
  size: 1.0,
  kind: 'caption',
  fill: '#ffffff',
  stroke: '#1b1815',
  color: '#1b1815',
  ...opts,
});

/** The full sticker catalogue, grouped by pack. */
export const STICKERS: StickerDef[] = [
  /* --- 背手负鼠: the defining meme of 2026 -------------------------------- */
  // The original pack is a possum with its paws behind its back, deadpan,
  // paired with reassuring-but-useless slogans. Its appeal is 嘴替 — it says
  // what exhausted people cannot be bothered to say.
  {
    id: 'fushu-1',
    glyph: '🐭',
    label: '背手负鼠',
    category: 'fushu',
    size: 1.15,
    hot: true,
  },
  cap('fushu-2', '关于明天的事\n后天就知道了', '负鼠·明天', 'fushu', {
    hot: true,
    fill: '#fdf6e6',
    stroke: '#8a6b3a',
    color: '#5c4423',
  }),
  cap('fushu-3', '慢慢急\n不要来', '负鼠·慢慢急', 'fushu', {
    hot: true,
    fill: '#eef4ea',
    stroke: '#5f7a52',
    color: '#3f5537',
  }),
  cap('fushu-4', '不回避难题\n先调整心情', '负鼠·心态', 'fushu', {
    fill: '#f3eef8',
    stroke: '#6d5a86',
    color: '#4a3b60',
  }),
  cap('fushu-5', '假装很从容', '负鼠·从容', 'fushu', {
    fill: '#ffffff',
    stroke: '#1b1815',
    color: '#1b1815',
  }),
  cap('fushu-6', '别催\n在想了', '负鼠·别催', 'fushu', {
    fill: '#fdf0ea',
    stroke: '#b06a4a',
    color: '#7d452c',
  }),

  /* --- 哭哭马: the defect that out-charms the perfect version ------------ */
  // A Year-of-the-Horse plush whose mouth was sewn on upside-down. Became the
  // avatar for 牛马 (corporate drudges). The joke: the mistake is the appeal.
  {
    id: 'kukum-1',
    glyph: '🐴',
    label: '哭哭马',
    category: 'kukum',
    size: 1.15,
    hot: true,
  },
  cap('kukum-2', '我的心情\n就像这只马', '哭哭马·心情', 'kukum', {
    hot: true,
    fill: '#fff5f0',
    stroke: '#c4705a',
    color: '#8c4530',
  }),
  cap('kukum-3', '牛马本马', '哭哭马·牛马', 'kukum', {
    hot: true,
    fill: '#fdf1e8',
    stroke: '#a86a3c',
    color: '#75462a',
  }),
  cap('kukum-4', '委屈\n但可爱', '哭哭马·委屈', 'kukum', {
    fill: '#fff8f4',
    stroke: '#c98d7a',
    color: '#8f5a48',
  }),
  cap('kukum-5', '瑕疵版\n更可爱', '哭哭马·瑕疵', 'kukum', {
    fill: '#f5f0fb',
    stroke: '#7d68a0',
    color: '#564674',
  }),
  cap('kukum-6', '上班如上坟', '哭哭马·上班', 'kukum', {
    fill: '#f0f0f4',
    stroke: '#4a4a58',
    color: '#2e2e38',
  }),

  /* --- 不烧心: 2026's most-used compliment ------------------------------- */
  // "吃了不烧心" went from a food remark to the internet's highest praise —
  // meaning something is genuinely comfortable, no hidden cost.
  cap('btsx-1', '吃了不烧心', '不烧心', 'btsx', {
    hot: true,
    fill: '#fff9e8',
    stroke: '#c9a13c',
    color: '#8a6a1c',
  }),
  cap('btsx-2', '不烧心\n是真的好', '不烧心·真好', 'btsx', {
    hot: true,
    fill: '#fefaf0',
    stroke: '#b8973a',
    color: '#7d631d',
  }),
  cap('btsx-3', '这波\n不烧心', '不烧心·这波', 'btsx', {
    fill: '#f2f8f0',
    stroke: '#6d8a5c',
    color: '#47603a',
  }),
  cap('btsx-4', '舒服了', '不烧心·舒服', 'btsx', {
    fill: '#eef6fb',
    stroke: '#5c82a0',
    color: '#3d5c75',
  }),
  cap('btsx-5', '真香', '真香', 'btsx', {
    fill: '#fff4e6',
    stroke: '#c07a30',
    color: '#8a521a',
  }),
  cap('btsx-6', '今日份\n好心情', '好心情', 'btsx', {
    fill: '#fdf2f6',
    stroke: '#b06a86',
    color: '#7d4460',
  }),

  /* --- 雪山狐狸: the AI-video phenomenon --------------------------------- */
  // A short AI-generated video of a fox in the snow rescuing a duck racked up
  // billions of views and spawned endless remixes.
  {
    id: 'huli-1',
    glyph: '🦊',
    label: '雪山狐狸',
    category: 'huli',
    size: 1.15,
    hot: true,
  },
  cap('huli-2', '你在雪山\n救过狐狸吗', '狐狸·雪山', 'huli', {
    hot: true,
    fill: '#eef4fb',
    stroke: '#5a7fa6',
    color: '#3a5a78',
  }),
  cap('huli-3', '狐狸板鸭\n喜相逢', '狐狸·板鸭', 'huli', {
    fill: '#fdf4ee',
    stroke: '#b07a52',
    color: '#7d5232',
  }),
  {
    id: 'huli-4',
    glyph: '🦆',
    label: '板鸭',
    category: 'huli',
    size: 1.0,
  },
  {
    id: 'huli-5',
    glyph: '❄️',
    label: '雪',
    category: 'huli',
    size: 1.0,
  },
  cap('huli-6', '一场大雪', '狐狸·大雪', 'huli', {
    fill: '#f4f8fc',
    stroke: '#7d95ad',
    color: '#516b84',
  }),

  /* --- 打工人 ------------------------------------------------------------ */
  cap('work-1', '打工人\n打工魂', '打工人', 'work', {
    fill: '#1b1815',
    stroke: '#1b1815',
    color: '#f6f1e6',
  }),
  cap('work-2', '已读\n不回', '已读不回', 'work', {
    fill: '#f0eef2',
    stroke: '#5c5468',
    color: '#3d3547',
  }),
  cap('work-3', '摸鱼中', '摸鱼', 'work', {
    fill: '#eef6f2',
    stroke: '#4a7a68',
    color: '#2f5548',
  }),
  cap('work-4', '不想上班', '不想上班', 'work', {
    fill: '#fdf0f0',
    stroke: '#b0564e',
    color: '#7d352f',
  }),
  cap('work-5', '再睡五分钟', '再睡五分钟', 'work', {
    fill: '#eef2fb',
    stroke: '#5a6fa6',
    color: '#3a4a78',
  }),
  {
    id: 'work-6',
    glyph: '☕',
    label: '续命',
    category: 'work',
    size: 1.0,
  },

  /* --- 情绪 -------------------------------------------------------------- */
  {
    id: 'mood-1',
    glyph: '🥹',
    label: '感动',
    category: 'mood',
    size: 1.0,
  },
  {
    id: 'mood-2',
    glyph: '🫠',
    label: '融化',
    category: 'mood',
    size: 1.0,
  },
  {
    id: 'mood-3',
    glyph: '😮‍💨',
    label: '叹气',
    category: 'mood',
    size: 1.0,
  },
  {
    id: 'mood-4',
    glyph: '🙃',
    label: '倒立微笑',
    category: 'mood',
    size: 1.0,
  },
  {
    id: 'mood-5',
    glyph: '🥲',
    label: '含泪微笑',
    category: 'mood',
    size: 1.0,
  },
  {
    id: 'mood-6',
    glyph: '🫥',
    label: '透明',
    category: 'mood',
    size: 1.0,
  },

  /* --- 装饰 -------------------------------------------------------------- */
  {
    id: 'deco-1',
    glyph: '✨',
    label: '闪光',
    category: 'deco',
    size: 1.0,
  },
  {
    id: 'deco-2',
    glyph: '🎞️',
    label: '胶片',
    category: 'deco',
    size: 1.0,
  },
  {
    id: 'deco-3',
    glyph: '📷',
    label: '相机',
    category: 'deco',
    size: 1.0,
  },
  {
    id: 'deco-4',
    glyph: '🌈',
    label: '彩虹',
    category: 'deco',
    size: 1.0,
  },
  {
    id: 'deco-5',
    glyph: '🎀',
    label: '蝴蝶结',
    category: 'deco',
    size: 1.0,
  },
  {
    id: 'deco-6',
    glyph: '💫',
    label: '流星',
    category: 'deco',
    size: 1.0,
  },

  /* --- 心动 -------------------------------------------------------------- */
  {
    id: 'love-1',
    glyph: '❤️',
    label: '红心',
    category: 'love',
    size: 1.0,
  },
  {
    id: 'love-2',
    glyph: '💗',
    label: '心动',
    category: 'love',
    size: 1.0,
  },
  {
    id: 'love-3',
    glyph: '🫶',
    label: '比心',
    category: 'love',
    size: 1.0,
  },
  {
    id: 'love-4',
    glyph: '💌',
    label: '情书',
    category: 'love',
    size: 1.0,
  },
  cap('love-5', '喜欢你', '喜欢你', 'love', {
    fill: '#fdeef2',
    stroke: '#c06a86',
    color: '#8a3d5c',
  }),
  cap('love-6', '永远\n在一起', '在一起', 'love', {
    fill: '#f6eefb',
    stroke: '#8a6aa6',
    color: '#5f4478',
  }),

  /* --- 通用文字 ---------------------------------------------------------- */
  cap('text-1', '今天', '今天', 'text', {
    fill: '#ffffff',
    stroke: '#1b1815',
    color: '#1b1815',
  }),
  cap('text-2', '2026', '2026', 'text', {
    fill: '#1b1815',
    stroke: '#1b1815',
    color: '#f6f1e6',
  }),
  cap('text-3', '拍立得', '拍立得', 'text', {
    fill: '#ffffff',
    stroke: '#1b1815',
    color: '#1b1815',
  }),
  cap('text-4', '此刻', '此刻', 'text', {
    fill: '#fdf6e6',
    stroke: '#8a6b3a',
    color: '#5c4423',
  }),
  cap('text-5', '记录一下', '记录一下', 'text', {
    fill: '#eef4ea',
    stroke: '#5f7a52',
    color: '#3f5537',
  }),
  cap('text-6', '好日子', '好日子', 'text', {
    fill: '#fdf0ea',
    stroke: '#b06a4a',
    color: '#7d452c',
  }),
];

/** Fast lookup by sticker id. */
export const STICKER_BY_ID: Record<string, StickerDef> = STICKERS.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<string, StickerDef>,
);

/** Sticker definitions grouped by pack, preserving catalogue order. */
export const STICKERS_BY_CATEGORY: Record<StickerCategory, StickerDef[]> = STICKER_CATEGORIES.reduce(
  (acc, { id }) => {
    acc[id] = STICKERS.filter((def) => def.category === id);
    return acc;
  },
  {} as Record<StickerCategory, StickerDef[]>,
);

/** Pack ids that currently carry a trending sticker, for the picker badge. */
export const HOT_PACKS: ReadonlySet<StickerCategory> = new Set(
  STICKERS.filter((s) => s.hot).map((s) => s.category),
);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Clamp a number into the inclusive `[min, max]` range. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Create a runtime sticker from a catalogue entry.
 *
 * `x` / `y` are normalised 0..1 CENTER coordinates relative to the canvas.
 */
export function createSticker(def: StickerDef, x: number, y: number): StickerItem {
  const item: StickerItem = {
    id: def.id,
    glyph: def.glyph,
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
    scale: def.size,
    rotation: 0,
    kind: def.kind ?? 'glyph',
  };
  if (def.kind === 'caption') {
    if (def.fill) item.fill = def.fill;
    if (def.stroke) item.stroke = def.stroke;
    if (def.color) item.color = def.color;
  }
  return item;
}

/**
 * Create a runtime sticker with a unique instance id, so the same catalogue
 * entry can be placed multiple times on one sheet.
 */
export function createStickerInstance(def: StickerDef, x: number, y: number): StickerItem {
  const base = createSticker(def, x, y);
  const unique = `${def.id}-${Math.random().toString(36).slice(2, 8)}`;
  return { ...base, id: unique };
}

/* -------------------------------------------------------------------------- */
/* Canvas drawing helpers                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Font size (in logical px) for a glyph sticker, proportional to canvas width.
 * Uses the shared {@link STICKER_FONT_RATIO} so the DOM overlay matches.
 */
export function stickerFontSize(item: StickerItem, canvasWidth: number): number {
  const safeScale = Number.isFinite(item.scale) ? item.scale : 1;
  if (item.kind === 'caption') {
    return Math.max(9, safeScale * canvasWidth * CAPTION_FONT_RATIO);
  }
  return Math.max(8, safeScale * canvasWidth * STICKER_FONT_RATIO);
}

/** Split a caption on its explicit newlines and wrap over-long lines. */
function captionLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const raw = text.split('\n');
  const out: string[] = [];
  for (const line of raw) {
    if (ctx.measureText(line).width <= maxWidth) {
      out.push(line);
      continue;
    }
    // Character-wise wrap for CJK text (no spaces to break on).
    let current = '';
    for (const ch of line) {
      const next = current + ch;
      if (ctx.measureText(next).width > maxWidth && current) {
        out.push(current);
        current = ch;
      } else {
        current = next;
      }
    }
    if (current) out.push(current);
  }
  return out.slice(0, 4);
}

/**
 * Draw a caption sticker: a rounded bubble with a bold outline and centred
 * text — the visual language of current sticker packs.
 */
function drawCaptionSticker(
  ctx: CanvasRenderingContext2D,
  item: StickerItem,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const fontSize = stickerFontSize(item, canvasWidth);
  const cx = item.x * canvasWidth;
  const cy = item.y * canvasHeight;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(item.rotation);

  ctx.font = `700 ${fontSize}px ${STICKER_CAPTION_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxTextWidth = canvasWidth * 0.62;
  const lines = captionLines(ctx, item.glyph, maxTextWidth);
  const lineHeight = fontSize * 1.22;

  // Bubble geometry.
  const widest = lines.reduce((w, l) => Math.max(w, ctx.measureText(l).width), 0);
  const padX = fontSize * 0.62;
  const padY = fontSize * 0.46;
  const bw = widest + padX * 2;
  const bh = lines.length * lineHeight + padY * 2;
  const r = Math.min(bh / 2, fontSize * 0.55);

  const x0 = -bw / 2;
  const y0 = -bh / 2;

  // Soft drop shadow so the sticker lifts off the photo.
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = fontSize * 0.22;
  ctx.shadowOffsetY = fontSize * 0.08;

  // Bubble fill + outline.
  ctx.beginPath();
  roundRectPath(ctx, x0, y0, bw, bh, r);
  ctx.fillStyle = item.fill ?? '#ffffff';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.lineWidth = Math.max(1.2, fontSize * 0.1);
  ctx.strokeStyle = item.stroke ?? '#1b1815';
  ctx.stroke();

  // Text.
  ctx.fillStyle = item.color ?? '#1b1815';
  const startY = -((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, 0, startY + i * lineHeight);
  });

  ctx.restore();
}

/** Rounded-rect path helper. */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

/**
 * Draw one sticker centred at `(item.x * canvasWidth, item.y * canvasHeight)`.
 */
export function drawSticker(
  ctx: CanvasRenderingContext2D,
  item: StickerItem,
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (item.kind === 'caption') {
    drawCaptionSticker(ctx, item, canvasWidth, canvasHeight);
    return;
  }

  const size = stickerFontSize(item, canvasWidth);
  const cx = item.x * canvasWidth;
  const cy = item.y * canvasHeight;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(item.rotation);
  ctx.font = `${size}px ${STICKER_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(item.glyph, 0, 0);
  ctx.restore();
}

/**
 * Draw a list of stickers in order.
 * Out-of-range anchors are skipped defensively rather than throwing.
 */
export function drawStickers(
  ctx: CanvasRenderingContext2D,
  stickers: readonly StickerItem[] | undefined,
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (!stickers || stickers.length === 0) return;
  for (const sticker of stickers) {
    if (!sticker || typeof sticker.glyph !== 'string') continue;
    drawSticker(ctx, sticker, canvasWidth, canvasHeight);
  }
}
