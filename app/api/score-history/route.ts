import { env } from "cloudflare:workers";

type D1Result<T> = { results?: T[] };
type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};
type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type SnapshotRow = {
  t: number;
  score: number;
  market_heat: number;
  fomo: number;
  fear: number;
  upside: number | null;
  downside: number | null;
};

const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 10 * 60 * 1000;
const MAX_POINTS = 4032;

export const dynamic = "force-dynamic";
export const revalidate = 0;

let tableReady = false;

function getD1(): D1Database | null {
  const binding = (env as Record<string, unknown>).DB;
  if (!binding || typeof (binding as D1Database).prepare !== "function") return null;
  return binding as D1Database;
}

async function ensureTable(db: D1Database) {
  if (tableReady) return;

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS score_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        t INTEGER NOT NULL,
        score INTEGER NOT NULL,
        market_heat INTEGER NOT NULL,
        fomo INTEGER NOT NULL,
        fear INTEGER NOT NULL,
        upside INTEGER,
        downside INTEGER
      )`,
    )
    .run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_score_snapshots_t ON score_snapshots (t)`).run();
  tableReady = true;
}

export async function GET() {
  const db = getD1();
  if (!db) {
    return Response.json(
      { available: false, points: [], message: "D1 binding `DB` is not configured." },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    await ensureTable(db);
    const cutoff = Date.now() - WINDOW_MS;
    const { results } = await db
      .prepare(`SELECT t, score, market_heat, fomo, fear, upside, downside FROM score_snapshots WHERE t >= ? ORDER BY t ASC LIMIT ?`)
      .bind(cutoff, MAX_POINTS)
      .all<SnapshotRow>();

    return Response.json(
      {
        available: true,
        points: (results ?? []).map((row) => ({
          t: row.t,
          score: row.score,
          marketHeat: row.market_heat,
          fomo: row.fomo,
          fear: row.fear,
          upside: row.upside,
          downside: row.downside,
        })),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return Response.json(
      { available: false, points: [], error: error instanceof Error ? error.message : "Unknown D1 error" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}

export async function POST(request: Request) {
  const db = getD1();
  if (!db) {
    return Response.json({ available: false, stored: false }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const payload = (await request.json()) as {
      t?: number;
      score?: number;
      marketHeat?: number;
      fomo?: number;
      fear?: number;
      upside?: number | null;
      downside?: number | null;
    };

    const t = Number(payload.t);
    const score = Number(payload.score);

    if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(score) || score < 0 || score > 100) {
      return Response.json({ available: true, stored: false, error: "invalid snapshot" }, { status: 400 });
    }

    await ensureTable(db);

    const last = await db
      .prepare(`SELECT t, score FROM score_snapshots ORDER BY t DESC LIMIT 1`)
      .first<{ t: number; score: number }>();

    if (last && t - last.t < MIN_GAP_MS && Math.abs(score - last.score) < 2) {
      return Response.json({ available: true, stored: false, reason: "deduped" });
    }

    await db
      .prepare(`INSERT INTO score_snapshots (t, score, market_heat, fomo, fear, upside, downside) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        Math.round(t),
        Math.round(score),
        Math.round(Number(payload.marketHeat) || 0),
        Math.round(Number(payload.fomo) || 0),
        Math.round(Number(payload.fear) || 0),
        payload.upside === null || payload.upside === undefined ? null : Math.round(Number(payload.upside)),
        payload.downside === null || payload.downside === undefined ? null : Math.round(Number(payload.downside)),
      )
      .run();

    return Response.json({ available: true, stored: true });
  } catch (error) {
    return Response.json(
      { available: false, stored: false, error: error instanceof Error ? error.message : "Unknown D1 error" },
      { status: 500 },
    );
  }
}
