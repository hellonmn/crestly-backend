import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import { HANDLERS, TOOLS } from "./ai.tools";
import type {
  AiAskInput,
  AiAskResponse,
  AiSettings,
  AiSettingsUpdate,
  AiTestResult,
} from "@crestly/shared";

/* ============================================================
   AI assistant — Groq-backed chat with tool calling.

   Settings live in app_settings under "ai.*" keys:
     ai.enabled  → "1" | "0"
     ai.provider → "groq"
     ai.model    → e.g. "llama-3.3-70b-versatile"
     ai.api_key  → the API key (stored plain — tenant-scoped)

   The chat flow is a classic OpenAI-tool-use loop:
     1. Send the conversation + tool definitions to Groq.
     2. If the model returns tool_calls, run each handler locally
        against the live DB, append the results as a tool message,
        and loop.
     3. When the model returns plain content, that's the reply.

   The loop is capped at 4 iterations so a misbehaving model can't
   spin forever.
   ============================================================ */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_TOOL_ITERATIONS = 4;

const KEYS = {
  enabled: "ai.enabled",
  provider: "ai.provider",
  model: "ai.model",
  apiKey: "ai.api_key",
};

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly sessions: SessionsService,
  ) {}

  /* ─────────────────── Settings ─────────────────── */

  async getSettings(): Promise<AiSettings> {
    const rows = await this.prisma.db.app_settings.findMany({
      where: { setting_key: { startsWith: "ai." } },
    });
    const map = new Map(rows.map((r) => [r.setting_key, r.setting_value ?? ""]));
    const apiKey = map.get(KEYS.apiKey) ?? "";
    return {
      enabled:  (map.get(KEYS.enabled) ?? "0") === "1",
      provider: ((map.get(KEYS.provider) ?? "groq") as "groq"),
      model:    map.get(KEYS.model) || "llama-3.3-70b-versatile",
      apiKey:   apiKey ? maskKey(apiKey) : null,
      hasKey:   apiKey.length > 0,
    };
  }

  async updateSettings(input: AiSettingsUpdate, userId: number): Promise<AiSettings> {
    const writes: { key: string; value: string }[] = [
      { key: KEYS.enabled,  value: input.enabled ? "1" : "0" },
      { key: KEYS.provider, value: input.provider },
      { key: KEYS.model,    value: input.model },
    ];
    // apiKey semantics:
    //   undefined / null → leave existing untouched
    //   ""               → clear
    //   any other string → overwrite
    if (input.apiKey !== undefined && input.apiKey !== null) {
      writes.push({ key: KEYS.apiKey, value: input.apiKey });
    }
    for (const w of writes) {
      await this.prisma.db.app_settings.upsert({
        where: { setting_key: w.key },
        update: { setting_value: w.value, updated_by: userId, updated_at: new Date() },
        create: { setting_key: w.key, setting_value: w.value, updated_by: userId },
      });
    }
    return this.getSettings();
  }

  async testConnection(): Promise<AiTestResult> {
    const cfg = await this.readConfig();
    const start = Date.now();
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: "user", content: "Reply with just the word 'ok'." }],
          max_tokens: 8,
        }),
      });
      const ms = Date.now() - start;
      if (!res.ok) {
        const body = await res.text();
        return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}`, model: cfg.model };
      }
      return { ok: true, latencyMs: ms, model: cfg.model };
    } catch (e) {
      return { ok: false, error: errMsg(e) };
    }
  }

  /* ─────────────────── Ask (chat with tool use) ─────────────────── */

  async ask(input: AiAskInput): Promise<AiAskResponse> {
    const cfg = await this.readConfig();
    if (!cfg.enabled) {
      throw new ForbiddenException("AI assistant is disabled. Enable it from Settings → AI.");
    }
    const session = await this.sessions.current();

    const toolCtx = { prisma: this.prisma.db as never, sessionCode: session.code };

    // Working message list, formatted for OpenAI/Groq.
    type Role = "system" | "user" | "assistant" | "tool";
    type ApiMsg = {
      role: Role;
      content: string | null;
      name?: string;
      tool_call_id?: string;
      tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
    };

    const messages: ApiMsg[] = [
      { role: "system", content: buildSystemPrompt(session.code) },
      ...input.messages.map((m): ApiMsg => ({ role: m.role, content: m.content })),
    ];

    const toolsUsed: AiAskResponse["toolsUsed"] = [];
    const t0 = Date.now();

    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          tools: TOOLS.map((t) => ({ type: "function", function: t })),
          tool_choice: "auto",
          temperature: 0.2,
          max_tokens: 1024,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new BadRequestException(`Groq returned HTTP ${res.status}: ${body.slice(0, 300)}`);
      }
      const json = await res.json() as {
        choices: { message: ApiMsg }[];
      };
      const msg = json.choices[0]?.message;
      if (!msg) throw new BadRequestException("Empty response from Groq.");
      messages.push(msg);

      // No tool calls? we're done.
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return {
          reply: (msg.content ?? "").trim(),
          toolsUsed,
          latencyMs: Date.now() - t0,
        };
      }

      // Run each tool call, append a tool message per call.
      for (const call of msg.tool_calls) {
        const name = call.function.name;
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(call.function.arguments || "{}"); } catch { /* keep {} */ }

        const handler = HANDLERS[name];
        let result: unknown;
        if (!handler) {
          result = { error: `No such tool: ${name}` };
        } else {
          try {
            result = await handler(parsed, toolCtx);
          } catch (e) {
            result = { error: errMsg(e) };
          }
        }
        toolsUsed.push({
          name,
          args: parsed,
          resultSummary: oneLineSummary(result),
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content: JSON.stringify(result).slice(0, 8000),
        });
      }
    }
    // Hit the tool-iteration cap — return whatever the last assistant said.
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    return {
      reply: (last?.content ?? "I tried several lookups but couldn't finish. Please rephrase the question or try a narrower query.").trim(),
      toolsUsed,
      latencyMs: Date.now() - t0,
    };
  }

  /* ─────────────────── Internals ─────────────────── */

  private async readConfig(): Promise<{ enabled: boolean; provider: string; model: string; apiKey: string }> {
    const rows = await this.prisma.db.app_settings.findMany({
      where: { setting_key: { in: Object.values(KEYS) } },
    });
    const map = new Map(rows.map((r) => [r.setting_key, r.setting_value ?? ""]));
    const cfg = {
      enabled:  (map.get(KEYS.enabled) ?? "0") === "1",
      provider: map.get(KEYS.provider) ?? "groq",
      model:    map.get(KEYS.model) || "llama-3.3-70b-versatile",
      apiKey:   map.get(KEYS.apiKey) ?? "",
    };
    if (!cfg.apiKey) {
      throw new NotFoundException("AI API key is not configured. Set it under Settings → AI.");
    }
    return cfg;
  }
}

/* ─────────────────── Helpers ─────────────────── */

function buildSystemPrompt(sessionCode: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    "You are an in-app assistant for Crestly — a school ERP used by admins, principals, and teachers.",
    `The current academic session is "${sessionCode}". Today's date is ${today}.`,
    "",
    "When answering data questions, ALWAYS call the appropriate tool first instead of guessing. Tools return live data from the school's database.",
    "",
    "Guidelines:",
    "- Be concise. One short paragraph or a tight bullet list — never a wall of text.",
    "- Format money as ₹ followed by the number (e.g. ₹12,450).",
    "- Format dates as 'DD MMM' (e.g. '24 May') unless the user asked for a different format.",
    "- If a tool returns 0 matches, say so plainly — don't invent students or amounts.",
    "- If the user's question is vague (e.g. 'Rohit'), call student_lookup with their query and present the matches; let the user pick.",
    "- The user may write in Hindi, Hinglish, or English. Reply in the same style they used.",
    "- Don't expose internal IDs unless the user asked.",
  ].join("\n");
}

function maskKey(k: string): string {
  if (k.length <= 6) return "••••";
  return `••••${k.slice(-4)}`;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

function oneLineSummary(result: unknown): string {
  try {
    const s = JSON.stringify(result);
    return s.length > 140 ? s.slice(0, 137) + "…" : s;
  } catch {
    return "(unserialisable)";
  }
}
