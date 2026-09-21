// ===== components/games/skins.ts =====
// Infraestructura compartida de skins para los motores reales del catálogo.
// Un motor declara sus roles propios (`E`) y su `SkinSet` en
// `<juego>/skins.ts`; este módulo solo define el contrato común (paleta,
// persistencia, utilidades de contraste/glow) para que no se repita por
// juego. Creado por el agente skin-designer al aplicar skins a Asteroids
// (primer motor migrado); Tetris sigue usando sus propios ids de skin
// (`retro`/`neon`/`pastel`/`pixel`) hasta su propia migración a `clasico`.

export const SKINS_BASE = ["clasico", "retro", "neon"] as const;
export type SkinBaseId = (typeof SKINS_BASE)[number];

export const SKINS_EXTRA = ["pastel", "pixel"] as const;
export type SkinId = SkinBaseId | (typeof SKINS_EXTRA)[number];

export const SKIN_DEFAULT: SkinBaseId = "clasico";

export const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "Clásico",
  retro: "Retro",
  neon: "Neon",
  pastel: "Pastel",
  pixel: "Pixel Art",
};

/**
 * Paleta que consume el `draw()` de un motor. `entities` recoge los roles
 * propios de ese juego (bala/propulsor en Asteroids, bloques en Arkanoid...);
 * `{}` si el juego no tiene ninguno.
 */
export interface SkinPalette<E extends string = never> {
  /** Fondo del área jugable; el marco CRT exterior sigue negro siempre. */
  bg: string;
  /** Rejilla/estructura sutil ("transparent" donde hoy no hay). */
  grid: string;
  /** Forma protagonista — máximo contraste. */
  ink: string;
  /** Apoyo (cuerpo, partículas, estelas). */
  inkDim: string;
  /** Lo que debe cantar (bola, power-up, cabeza). */
  accent: string;
  /** Explosiones, muerte. */
  danger: string;
  /** Texto dibujado DENTRO del canvas por el motor. */
  hud: string;
  /** Si no es null, envuelve trazos con shadowColor (ver conGlow). */
  glow: string | null;
  /** Roles propios del juego; {} si no tiene. */
  entities: Readonly<Record<E, string>>;
}

export type SkinSet<Id extends SkinId, E extends string = never> = Readonly<
  Record<Id, SkinPalette<E>>
>;

export function esSkinId(v: unknown): v is SkinId {
  return (
    typeof v === "string" &&
    ((SKINS_BASE as readonly string[]).includes(v) ||
      (SKINS_EXTRA as readonly string[]).includes(v))
  );
}

/** Envuelve una operación de dibujo con un halo (shadowBlur/shadowColor). */
export function conGlow(
  ctx: CanvasRenderingContext2D,
  glow: string | null,
  blur: number,
  dibujar: () => void,
): void {
  if (!glow) {
    dibujar();
    return;
  }
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = blur;
  dibujar();
  ctx.restore();
}

/** Generaliza hexToRgb de tetris/engine.ts a un `rgba()` con alpha. */
export function hexARgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function canalLineal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Luminancia relativa WCAG de un color hex. */
export function luminancia(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * canalLineal(r) + 0.7152 * canalLineal(g) + 0.0722 * canalLineal(b);
}

/** Ratio de contraste WCAG entre dos colores hex. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, oscuro] = la >= lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

// ── Persistencia ────────────────────────────────────────────────────────────

const LEGACY_TETRIS_SKIN_KEY = "tetris-skin";
const LEGACY_TETRIS_THEME_KEY = "tetris-theme";

export function claveSkin(gameId: string): string {
  return `av-skin-${gameId}`;
}

/**
 * Lee la skin guardada para `gameId`, validando que siga entre `permitidas`.
 * Migra la clave legacy `tetris-skin` a `av-skin-tetris` (solo Tetris) y
 * borra la clave muerta `tetris-theme`. Sin `localStorage` (SSR) devuelve
 * `permitidas[0]`.
 */
export function leerSkin(gameId: string, permitidas: readonly SkinId[]): SkinId {
  const fallback = permitidas[0] ?? SKIN_DEFAULT;
  if (typeof window === "undefined") return fallback;

  if (gameId === "tetris") {
    const legacy = window.localStorage.getItem(LEGACY_TETRIS_SKIN_KEY);
    if (legacy !== null) {
      window.localStorage.setItem(claveSkin(gameId), legacy);
      window.localStorage.removeItem(LEGACY_TETRIS_SKIN_KEY);
    }
    window.localStorage.removeItem(LEGACY_TETRIS_THEME_KEY);
  }

  const guardada = window.localStorage.getItem(claveSkin(gameId));
  if (guardada && esSkinId(guardada) && (permitidas as readonly string[]).includes(guardada)) {
    return guardada;
  }
  return fallback;
}

export function guardarSkin(gameId: string, skin: SkinId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(claveSkin(gameId), skin);
}
