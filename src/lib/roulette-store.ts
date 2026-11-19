import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { cleanCPF, formatCPF, isValidCPF, maskCPF, normalizeFullName } from "@/lib/cpf";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";
import type {
  AdminRouletteState,
  AdminWinner,
  Prize,
  PublicRouletteState,
  PublicWinner,
  RouletteSettings,
  SpinSuccessResponse,
} from "@/lib/types";

export class RouletteActionError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "RouletteActionError";
    this.status = status;
    this.code = code;
  }
}

interface DemoParticipant {
  id: string;
  fullName: string;
  cpf: string;
  createdAt: string;
}

interface DemoSpin {
  id: string;
  participantId: string;
  prizeId: string | null;
  prizeName: string;
  prizeCategory: string;
  prizeColor: string | null;
  spunAt: string;
}

interface DemoDb {
  settings: RouletteSettings;
  prizes: Prize[];
  participants: DemoParticipant[];
  spins: DemoSpin[];
}

const DEMO_DB_PATH = path.join(process.cwd(), ".local-demo-db.json");

const INITIAL_SEED_PRIZES: Array<{
  name: string;
  description: string;
  category: string;
  color: string;
}> = [
  {
    name: "Jaleco Bordado UCPel",
    description: "Jaleco branco acinturado com brasão oficial de Biomedicina UCPel.",
    category: "Vestuário",
    color: "#205937",
  },
  {
    name: "Kit Estética & Cosmetologia",
    description: "Necessaire exclusiva com séruns demonstrativos da área de Cosmetologia.",
    category: "Estética",
    color: "#725387",
  },
  {
    name: "Caneca Térmica Laboratório",
    description: "Caneca personalizada Biomedicina UCPel • Conhecimento & Conexão.",
    category: "Laboratório",
    color: "#C9DCD1",
  },
  {
    name: "Ecobag Biomedicina UCPel",
    description: "Sacola ecológica institucional do curso de Biomedicina Pelotas.",
    category: "Institucional",
    color: "#4D8742",
  },
  {
    name: "Caderno Científico + Caneta",
    description: "Caderno pautado de práticas laboratoriais + caneta temática.",
    category: "Acadêmico",
    color: "#DECBE9",
  },
  {
    name: "Pin Brasão Biomedicina",
    description: "Broche esmaltado com o escudo e microscópio para jaleco.",
    category: "Acessório",
    color: "#1E2721",
  },
  {
    name: "Squeeze Inox Campus Saúde",
    description: "Garrafa térmica 500ml com identidade botânica Biomedicina UCPel.",
    category: "Brinde",
    color: "#7BA943",
  },
  {
    name: "Visita Guiada Laboratórios",
    description: "Tour exclusivo pelos laboratórios de práticas e Hospital de Simulação.",
    category: "Experiência",
    color: "#F4F4EE",
  },
];

const globalForDemo = globalThis as typeof globalThis & {
  __ucpelRoletaDemoDb?: DemoDb;
  __ucpelRoletaDemoLock?: Promise<void>;
};

function createSeedDemoDb(): DemoDb {
  const now = new Date().toISOString();
  return {
    settings: {
      eventTitle: "Roleta Biomedicina UCPel • Pelotas",
      allowMultipleSpinsPerCpf: false,
      isActive: true,
      updatedAt: now,
    },
    prizes: INITIAL_SEED_PRIZES.map((item, idx) => ({
      id: randomUUID(),
      name: item.name,
      description: item.description,
      category: item.category,
      color: item.color,
      isAvailable: true,
      claimedAt: null,
      claimedByParticipantId: null,
      createdAt: new Date(Date.now() + idx).toISOString(),
    })),
    participants: [],
    spins: [],
  };
}

async function readDemoDb(): Promise<DemoDb> {
  if (globalForDemo.__ucpelRoletaDemoDb) {
    return globalForDemo.__ucpelRoletaDemoDb;
  }

  try {
    const raw = await fs.readFile(DEMO_DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as DemoDb;
    if (parsed && Array.isArray(parsed.prizes) && parsed.settings) {
      globalForDemo.__ucpelRoletaDemoDb = parsed;
      return parsed;
    }
  } catch {
    // Arquivo ainda não existe ou ambiente read-only: cria estado inicial
  }

  const seeded = createSeedDemoDb();
  globalForDemo.__ucpelRoletaDemoDb = seeded;
  await writeDemoDb(seeded);
  return seeded;
}

async function writeDemoDb(db: DemoDb): Promise<void> {
  globalForDemo.__ucpelRoletaDemoDb = db;
  try {
    await fs.writeFile(DEMO_DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch {
    // Ignora caso o filesystem seja somente leitura (ex.: serverless)
  }
}

async function withDemoLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = globalForDemo.__ucpelRoletaDemoLock ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalForDemo.__ucpelRoletaDemoLock = previous.then(() => next);
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

// ============================================================================
// Mapeadores Supabase
// ============================================================================

interface DbPrizeRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  color: string | null;
  is_available: boolean;
  claimed_at: string | null;
  claimed_by_participant_id: string | null;
  created_at: string;
}

interface DbSettingsRow {
  id: number;
  event_title: string;
  allow_multiple_spins_per_cpf: boolean;
  is_active: boolean;
  updated_at: string;
}

interface DbSpinRow {
  id: string;
  participant_id: string;
  prize_id: string | null;
  prize_name: string;
  prize_category: string;
  prize_color: string | null;
  spun_at: string;
  participants: { full_name: string; cpf: string } | Array<{ full_name: string; cpf: string }> | null;
}

function mapPrizeRow(row: DbPrizeRow): Prize {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    color: row.color,
    isAvailable: row.is_available,
    claimedAt: row.claimed_at,
    claimedByParticipantId: row.claimed_by_participant_id,
    createdAt: row.created_at,
  };
}

function mapSettingsRow(row: DbSettingsRow | null): RouletteSettings {
  if (!row) {
    return {
      eventTitle: "Roleta Biomedicina UCPel • Pelotas",
      allowMultipleSpinsPerCpf: false,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    eventTitle: row.event_title,
    allowMultipleSpinsPerCpf: row.allow_multiple_spins_per_cpf,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

function extractParticipant(
  rel: DbSpinRow["participants"]
): { full_name: string; cpf: string } | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

function mapPublicWinner(row: DbSpinRow): PublicWinner {
  const participant = extractParticipant(row.participants);
  return {
    spinId: row.id,
    participantName: participant?.full_name ?? "Participante",
    maskedCpf: maskCPF(participant?.cpf ?? ""),
    prizeId: row.prize_id ?? "",
    prizeName: row.prize_name,
    prizeCategory: row.prize_category,
    prizeColor: row.prize_color,
    spunAt: row.spun_at,
  };
}

function mapAdminWinner(row: DbSpinRow): AdminWinner {
  const participant = extractParticipant(row.participants);
  const rawCpf = participant?.cpf ?? "";
  return {
    ...mapPublicWinner(row),
    cpf: rawCpf,
    formattedCpf: rawCpf.length === 11 ? formatCPF(rawCpf) : rawCpf,
  };
}

function parseSupabaseSpinError(message: string): RouletteActionError {
  if (message.includes("INVALID_NAME:")) {
    return new RouletteActionError(
      message.split("INVALID_NAME:")[1].trim(),
      400,
      "INVALID_NAME"
    );
  }
  if (message.includes("INVALID_CPF:")) {
    return new RouletteActionError(
      message.split("INVALID_CPF:")[1].trim(),
      400,
      "INVALID_CPF"
    );
  }
  if (message.includes("ROULETTE_INACTIVE:")) {
    return new RouletteActionError(
      message.split("ROULETTE_INACTIVE:")[1].trim(),
      403,
      "ROULETTE_INACTIVE"
    );
  }
  if (message.includes("ALREADY_SPUN:")) {
    return new RouletteActionError(
      message.split("ALREADY_SPUN:")[1].trim(),
      409,
      "ALREADY_SPUN"
    );
  }
  if (message.includes("NO_PRIZES_AVAILABLE:")) {
    return new RouletteActionError(
      message.split("NO_PRIZES_AVAILABLE:")[1].trim(),
      409,
      "NO_PRIZES_AVAILABLE"
    );
  }
  return new RouletteActionError(
    "Não foi possível concluir o giro no momento. Tente novamente.",
    500,
    "SPIN_ERROR"
  );
}

// ============================================================================
// API Pública da Store
// ============================================================================

export async function getPublicRouletteState(): Promise<PublicRouletteState> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();

    const [settingsRes, prizesRes, spinsRes] = await Promise.all([
      supabase.from("roulette_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("prizes").select("*").order("created_at", { ascending: true }),
      supabase
        .from("spins")
        .select(
          "id, participant_id, prize_id, prize_name, prize_category, prize_color, spun_at, participants(full_name, cpf)"
        )
        .order("spun_at", { ascending: false })
        .limit(25),
    ]);

    if (settingsRes.error) throw new Error(settingsRes.error.message);
    if (prizesRes.error) throw new Error(prizesRes.error.message);
    if (spinsRes.error) throw new Error(spinsRes.error.message);

    const prizes = (prizesRes.data as DbPrizeRow[]).map(mapPrizeRow);
    const availablePrizes = prizes.filter((p) => p.isAvailable);
    const recentWinners = (spinsRes.data as unknown as DbSpinRow[]).map(mapPublicWinner);

    return {
      mode: "supabase",
      settings: mapSettingsRow((settingsRes.data as DbSettingsRow | null) ?? null),
      availablePrizes,
      totalPrizes: prizes.length,
      claimedCount: prizes.length - availablePrizes.length,
      recentWinners,
    };
  }

  const db = await readDemoDb();
  const availablePrizes = db.prizes.filter((p) => p.isAvailable);
  const participantMap = new Map(db.participants.map((p) => [p.id, p]));
  const recentWinners: PublicWinner[] = [...db.spins]
    .sort((a, b) => b.spunAt.localeCompare(a.spunAt))
    .slice(0, 25)
    .map((spin) => {
      const participant = participantMap.get(spin.participantId);
      return {
        spinId: spin.id,
        participantName: participant?.fullName ?? "Participante",
        maskedCpf: maskCPF(participant?.cpf ?? ""),
        prizeId: spin.prizeId ?? "",
        prizeName: spin.prizeName,
        prizeCategory: spin.prizeCategory,
        prizeColor: spin.prizeColor,
        spunAt: spin.spunAt,
      };
    });

  return {
    mode: "demo",
    settings: db.settings,
    availablePrizes,
    totalPrizes: db.prizes.length,
    claimedCount: db.prizes.length - availablePrizes.length,
    recentWinners,
  };
}

export async function spinRoulette(
  rawFullName: string,
  rawCpf: string
): Promise<SpinSuccessResponse> {
  const fullName = normalizeFullName(rawFullName);
  const cpf = cleanCPF(rawCpf);

  if (fullName.length < 3 || fullName.length > 120) {
    throw new RouletteActionError(
      "Informe seu nome completo (mínimo 3 caracteres).",
      400,
      "INVALID_NAME"
    );
  }

  if (!isValidCPF(cpf)) {
    throw new RouletteActionError(
      "Informe um CPF válido com 11 dígitos.",
      400,
      "INVALID_CPF"
    );
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();

    const preSpinRes = await supabase
      .from("prizes")
      .select("*")
      .eq("is_available", true)
      .order("created_at", { ascending: true });

    let preSpinPrizes = ((preSpinRes.data as DbPrizeRow[] | null) ?? []).map(mapPrizeRow);

    const { data, error } = await supabase.rpc("spin_roulette", {
      p_full_name: fullName,
      p_cpf: cpf,
    });

    if (error) {
      throw parseSupabaseSpinError(error.message);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new RouletteActionError("Nenhum prêmio retornado pelo sorteio.", 500, "SPIN_ERROR");
    }

    const wonPrize: Prize = {
      id: row.prize_id,
      name: row.prize_name,
      description: row.prize_description,
      category: row.prize_category,
      color: row.prize_color,
      isAvailable: false,
      claimedAt: row.spun_at,
      claimedByParticipantId: null,
      createdAt: row.spun_at,
    };

    if (!preSpinPrizes.some((p) => p.id === wonPrize.id)) {
      preSpinPrizes = [...preSpinPrizes, { ...wonPrize, isAvailable: true }];
    }

    const spin: PublicWinner = {
      spinId: row.spin_id,
      participantName: row.participant_name,
      maskedCpf: maskCPF(cpf),
      prizeId: wonPrize.id,
      prizeName: wonPrize.name,
      prizeCategory: wonPrize.category,
      prizeColor: wonPrize.color,
      spunAt: row.spun_at,
    };

    const state = await getPublicRouletteState();
    return {
      mode: "supabase",
      prize: wonPrize,
      spin,
      preSpinPrizes,
      state,
    };
  }

  // Modo demonstração local com trava sequencial
  return withDemoLock(async () => {
    const db = await readDemoDb();

    if (!db.settings.isActive) {
      throw new RouletteActionError(
        "A roleta está pausada pela coordenação no momento.",
        403,
        "ROULETTE_INACTIVE"
      );
    }

    let participant = db.participants.find((p) => p.cpf === cpf);

    if (!db.settings.allowMultipleSpinsPerCpf && participant) {
      const previousSpin = [...db.spins]
        .reverse()
        .find((s) => s.participantId === participant!.id);
      if (previousSpin) {
        throw new RouletteActionError(
          `Este CPF já participou do sorteio e ganhou: ${previousSpin.prizeName}.`,
          409,
          "ALREADY_SPUN"
        );
      }
    }

    const preSpinPrizes = db.prizes
      .filter((p) => p.isAvailable)
      .map((p) => ({ ...p }));

    if (preSpinPrizes.length === 0) {
      throw new RouletteActionError(
        "Todos os itens da roleta já foram sorteados!",
        409,
        "NO_PRIZES_AVAILABLE"
      );
    }

    const chosenIndex = Math.floor(Math.random() * preSpinPrizes.length);
    const chosenId = preSpinPrizes[chosenIndex].id;
    const now = new Date().toISOString();

    if (!participant) {
      participant = {
        id: randomUUID(),
        fullName,
        cpf,
        createdAt: now,
      };
      db.participants.push(participant);
    } else {
      participant.fullName = fullName;
    }

    const targetPrize = db.prizes.find((p) => p.id === chosenId)!;
    targetPrize.isAvailable = false;
    targetPrize.claimedAt = now;
    targetPrize.claimedByParticipantId = participant.id;

    const spinRecord: DemoSpin = {
      id: randomUUID(),
      participantId: participant.id,
      prizeId: targetPrize.id,
      prizeName: targetPrize.name,
      prizeCategory: targetPrize.category,
      prizeColor: targetPrize.color,
      spunAt: now,
    };
    db.spins.push(spinRecord);

    await writeDemoDb(db);
    const state = await getPublicRouletteState();

    return {
      mode: "demo",
      prize: { ...targetPrize },
      spin: {
        spinId: spinRecord.id,
        participantName: participant.fullName,
        maskedCpf: maskCPF(participant.cpf),
        prizeId: targetPrize.id,
        prizeName: targetPrize.name,
        prizeCategory: targetPrize.category,
        prizeColor: targetPrize.color,
        spunAt: spinRecord.spunAt,
      },
      preSpinPrizes,
      state,
    };
  });
}

// ============================================================================
// Operações Administrativas
// ============================================================================

export async function getAdminRouletteState(): Promise<AdminRouletteState> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();

    const [settingsRes, prizesRes, spinsRes, participantsCountRes] = await Promise.all([
      supabase.from("roulette_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("prizes").select("*").order("created_at", { ascending: true }),
      supabase
        .from("spins")
        .select(
          "id, participant_id, prize_id, prize_name, prize_category, prize_color, spun_at, participants(full_name, cpf)"
        )
        .order("spun_at", { ascending: false }),
      supabase.from("participants").select("id", { count: "exact", head: true }),
    ]);

    if (settingsRes.error) throw new Error(settingsRes.error.message);
    if (prizesRes.error) throw new Error(prizesRes.error.message);
    if (spinsRes.error) throw new Error(spinsRes.error.message);
    if (participantsCountRes.error) throw new Error(participantsCountRes.error.message);

    return {
      mode: "supabase",
      settings: mapSettingsRow((settingsRes.data as DbSettingsRow | null) ?? null),
      prizes: (prizesRes.data as DbPrizeRow[]).map(mapPrizeRow),
      winners: (spinsRes.data as unknown as DbSpinRow[]).map(mapAdminWinner),
      totalParticipants: participantsCountRes.count ?? 0,
    };
  }

  const db = await readDemoDb();
  const participantMap = new Map(db.participants.map((p) => [p.id, p]));
  const winners: AdminWinner[] = [...db.spins]
    .sort((a, b) => b.spunAt.localeCompare(a.spunAt))
    .map((spin) => {
      const participant = participantMap.get(spin.participantId);
      const rawCpf = participant?.cpf ?? "";
      return {
        spinId: spin.id,
        participantName: participant?.fullName ?? "Participante",
        maskedCpf: maskCPF(rawCpf),
        cpf: rawCpf,
        formattedCpf: rawCpf.length === 11 ? formatCPF(rawCpf) : rawCpf,
        prizeId: spin.prizeId ?? "",
        prizeName: spin.prizeName,
        prizeCategory: spin.prizeCategory,
        prizeColor: spin.prizeColor,
        spunAt: spin.spunAt,
      };
    });

  return {
    mode: "demo",
    settings: db.settings,
    prizes: db.prizes,
    winners,
    totalParticipants: db.participants.length,
  };
}

export async function updateRouletteSettings(patch: {
  eventTitle?: string;
  allowMultipleSpinsPerCpf?: boolean;
  isActive?: boolean;
}): Promise<RouletteSettings> {
  const cleanTitle =
    typeof patch.eventTitle === "string"
      ? normalizeFullName(patch.eventTitle).slice(0, 100)
      : undefined;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (cleanTitle && cleanTitle.length >= 3) updatePayload.event_title = cleanTitle;
    if (typeof patch.allowMultipleSpinsPerCpf === "boolean") {
      updatePayload.allow_multiple_spins_per_cpf = patch.allowMultipleSpinsPerCpf;
    }
    if (typeof patch.isActive === "boolean") {
      updatePayload.is_active = patch.isActive;
    }

    const { data, error } = await supabase
      .from("roulette_settings")
      .upsert({ id: 1, ...updatePayload })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return mapSettingsRow(data as DbSettingsRow);
  }

  return withDemoLock(async () => {
    const db = await readDemoDb();
    if (cleanTitle && cleanTitle.length >= 3) db.settings.eventTitle = cleanTitle;
    if (typeof patch.allowMultipleSpinsPerCpf === "boolean") {
      db.settings.allowMultipleSpinsPerCpf = patch.allowMultipleSpinsPerCpf;
    }
    if (typeof patch.isActive === "boolean") {
      db.settings.isActive = patch.isActive;
    }
    db.settings.updatedAt = new Date().toISOString();
    await writeDemoDb(db);
    return db.settings;
  });
}

export async function addPrizes(input: {
  name: string;
  description?: string | null;
  category?: string;
  color?: string | null;
  quantity?: number;
}): Promise<Prize[]> {
  const name = normalizeFullName(input.name);
  if (name.length < 2 || name.length > 80) {
    throw new RouletteActionError(
      "O nome do item deve ter entre 2 e 80 caracteres.",
      400,
      "INVALID_PRIZE_NAME"
    );
  }

  const description = input.description ? normalizeFullName(input.description).slice(0, 220) : null;
  const category = normalizeFullName(input.category || "Brinde").slice(0, 40) || "Brinde";
  const color =
    input.color && /^#[0-9A-Fa-f]{6}$/.test(input.color.trim())
      ? input.color.trim().toUpperCase()
      : null;
  const quantity = Math.min(20, Math.max(1, Math.floor(Number(input.quantity) || 1)));

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const rows = Array.from({ length: quantity }, () => ({
      name,
      description,
      category,
      color,
      is_available: true,
    }));

    const { data, error } = await supabase.from("prizes").insert(rows).select("*");
    if (error) throw new Error(error.message);
    return (data as DbPrizeRow[]).map(mapPrizeRow);
  }

  return withDemoLock(async () => {
    const db = await readDemoDb();
    const baseTime = Date.now();
    const created: Prize[] = Array.from({ length: quantity }, (_, idx) => ({
      id: randomUUID(),
      name,
      description,
      category,
      color,
      isAvailable: true,
      claimedAt: null,
      claimedByParticipantId: null,
      createdAt: new Date(baseTime + idx).toISOString(),
    }));
    db.prizes.push(...created);
    await writeDemoDb(db);
    return created;
  });
}

export async function updatePrize(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    category?: string;
    color?: string | null;
    isAvailable?: boolean;
  }
): Promise<Prize> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const updatePayload: Record<string, unknown> = {};

    if (typeof patch.name === "string") {
      const cleanName = normalizeFullName(patch.name);
      if (cleanName.length < 2 || cleanName.length > 80) {
        throw new RouletteActionError(
          "O nome do item deve ter entre 2 e 80 caracteres.",
          400,
          "INVALID_PRIZE_NAME"
        );
      }
      updatePayload.name = cleanName;
    }

    if (patch.description !== undefined) {
      updatePayload.description = patch.description
        ? normalizeFullName(patch.description).slice(0, 220)
        : null;
    }

    if (typeof patch.category === "string") {
      updatePayload.category = normalizeFullName(patch.category).slice(0, 40) || "Brinde";
    }

    if (patch.color !== undefined) {
      updatePayload.color =
        patch.color && /^#[0-9A-Fa-f]{6}$/.test(patch.color.trim())
          ? patch.color.trim().toUpperCase()
          : null;
    }

    if (typeof patch.isAvailable === "boolean") {
      updatePayload.is_available = patch.isAvailable;
      if (patch.isAvailable) {
        updatePayload.claimed_at = null;
        updatePayload.claimed_by_participant_id = null;
      } else {
        updatePayload.claimed_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from("prizes")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return mapPrizeRow(data as DbPrizeRow);
  }

  return withDemoLock(async () => {
    const db = await readDemoDb();
    const prize = db.prizes.find((p) => p.id === id);
    if (!prize) {
      throw new RouletteActionError("Item não encontrado.", 404, "NOT_FOUND");
    }

    if (typeof patch.name === "string") {
      const cleanName = normalizeFullName(patch.name);
      if (cleanName.length < 2 || cleanName.length > 80) {
        throw new RouletteActionError(
          "O nome do item deve ter entre 2 e 80 caracteres.",
          400,
          "INVALID_PRIZE_NAME"
        );
      }
      prize.name = cleanName;
    }

    if (patch.description !== undefined) {
      prize.description = patch.description
        ? normalizeFullName(patch.description).slice(0, 220)
        : null;
    }

    if (typeof patch.category === "string") {
      prize.category = normalizeFullName(patch.category).slice(0, 40) || "Brinde";
    }

    if (patch.color !== undefined) {
      prize.color =
        patch.color && /^#[0-9A-Fa-f]{6}$/.test(patch.color.trim())
          ? patch.color.trim().toUpperCase()
          : null;
    }

    if (typeof patch.isAvailable === "boolean") {
      prize.isAvailable = patch.isAvailable;
      if (patch.isAvailable) {
        prize.claimedAt = null;
        prize.claimedByParticipantId = null;
      } else {
        prize.claimedAt = new Date().toISOString();
      }
    }

    await writeDemoDb(db);
    return prize;
  });
}

export async function deletePrize(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("prizes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }

  await withDemoLock(async () => {
    const db = await readDemoDb();
    db.prizes = db.prizes.filter((p) => p.id !== id);
    await writeDemoDb(db);
  });
}

export async function resetRoulette(clearHistory: boolean): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (clearHistory) {
      const { error: spinsErr } = await supabase
        .from("spins")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (spinsErr) throw new Error(spinsErr.message);

      const { error: participantsErr } = await supabase
        .from("participants")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (participantsErr) throw new Error(participantsErr.message);
    }

    const { error: prizesErr } = await supabase
      .from("prizes")
      .update({
        is_available: true,
        claimed_at: null,
        claimed_by_participant_id: null,
      })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (prizesErr) throw new Error(prizesErr.message);
    return;
  }

  await withDemoLock(async () => {
    const db = await readDemoDb();
    if (clearHistory) {
      db.spins = [];
      db.participants = [];
    }
    db.prizes = db.prizes.map((p) => ({
      ...p,
      isAvailable: true,
      claimedAt: null,
      claimedByParticipantId: null,
    }));
    await writeDemoDb(db);
  });
}
