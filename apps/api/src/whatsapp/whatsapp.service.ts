import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type {
  WaActionBinding, WaBindingUpsertInput, WaLogEntry, WaSettings, WaSettingsUpdate, WaTemplate,
} from "@crestly/shared";

const KEYS = {
  enabled: "whatsapp.enabled",
  accessToken: "whatsapp.access_token",
  phoneNumberId: "whatsapp.phone_number_id",
  wabaId: "whatsapp.waba_id",
  apiVersion: "whatsapp.api_version",
  displayNumber: "whatsapp.display_number",
  defaultCountry: "whatsapp.default_country",
} as const;

@Injectable()
export class WhatsappService {
  constructor(private readonly prisma: RequestPrismaService) {}

  // --- settings ---

  async getSettings(reveal = false): Promise<WaSettings> {
    const rows = await this.prisma.db.app_settings.findMany({
      where: { setting_key: { startsWith: "whatsapp." } },
    });
    const map = new Map(rows.map((r) => [r.setting_key, r.setting_value]));
    const token = map.get(KEYS.accessToken);
    return {
      enabled: map.get(KEYS.enabled) === "1",
      accessToken: token ? (reveal ? token : maskToken(token)) : null,
      phoneNumberId: map.get(KEYS.phoneNumberId) ?? null,
      wabaId: map.get(KEYS.wabaId) ?? null,
      apiVersion: map.get(KEYS.apiVersion) ?? "v22.0",
      displayNumber: map.get(KEYS.displayNumber) ?? null,
      defaultCountry: map.get(KEYS.defaultCountry) ?? "91",
    };
  }

  async updateSettings(input: WaSettingsUpdate, userId: number): Promise<WaSettings> {
    const updates: [string, string | null][] = [];
    if (input.enabled !== undefined) updates.push([KEYS.enabled, input.enabled ? "1" : "0"]);
    if (input.accessToken !== undefined && input.accessToken && !input.accessToken.startsWith("****")) {
      updates.push([KEYS.accessToken, input.accessToken]);
    }
    if (input.phoneNumberId !== undefined) updates.push([KEYS.phoneNumberId, input.phoneNumberId]);
    if (input.wabaId !== undefined) updates.push([KEYS.wabaId, input.wabaId]);
    if (input.apiVersion !== undefined) updates.push([KEYS.apiVersion, input.apiVersion]);
    if (input.displayNumber !== undefined) updates.push([KEYS.displayNumber, input.displayNumber]);
    if (input.defaultCountry !== undefined) updates.push([KEYS.defaultCountry, input.defaultCountry]);

    for (const [k, v] of updates) {
      await this.prisma.db.app_settings.upsert({
        where: { setting_key: k },
        update: { setting_value: v, updated_by: userId, updated_at: new Date() },
        create: { setting_key: k, setting_value: v, updated_by: userId },
      });
    }
    return this.getSettings();
  }

  // --- templates ---

  async listTemplates(): Promise<WaTemplate[]> {
    const rows = await this.prisma.db.wa_templates.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id, name: r.name, language: r.language,
      category: r.category, status: r.status,
      bodyText: r.body_text, headerText: r.header_text, footerText: r.footer_text,
      variableCount: r.variable_count,
      metaId: r.meta_id,
      fetchedAt: r.fetched_at ? r.fetched_at.toISOString() : null,
    }));
  }

  /**
   * Refresh templates from Meta Cloud API. Idempotent — upserts by (name, language).
   */
  async refreshFromMeta(): Promise<{ ok: true; synced: number }> {
    const settings = await this.getSettings(true);
    if (!settings.enabled || !settings.accessToken || !settings.wabaId) {
      throw new BadRequestException("WhatsApp credentials are incomplete or disabled.");
    }
    const url = `https://graph.facebook.com/${settings.apiVersion}/${settings.wabaId}/message_templates?limit=200`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${settings.accessToken}` },
    });
    if (!r.ok) {
      throw new BadRequestException(`Meta returned ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }
    const json = (await r.json()) as { data: any[] };
    let synced = 0;
    for (const tpl of json.data ?? []) {
      const body = (tpl.components ?? []).find((c: any) => c.type === "BODY")?.text ?? null;
      const header = (tpl.components ?? []).find((c: any) => c.type === "HEADER")?.text ?? null;
      const footer = (tpl.components ?? []).find((c: any) => c.type === "FOOTER")?.text ?? null;
      const varCount = (body ?? "").match(/\{\{\d+\}\}/g)?.length ?? 0;

      await this.prisma.db.wa_templates.upsert({
        where: { name_language: { name: tpl.name, language: tpl.language } },
        update: {
          category: tpl.category ?? null,
          status: tpl.status ?? null,
          body_text: body, header_text: header, footer_text: footer,
          components_json: JSON.stringify(tpl.components ?? []),
          variable_count: varCount,
          meta_id: tpl.id ?? null,
          fetched_at: new Date(),
        },
        create: {
          name: tpl.name,
          language: tpl.language,
          category: tpl.category ?? null,
          status: tpl.status ?? null,
          body_text: body, header_text: header, footer_text: footer,
          components_json: JSON.stringify(tpl.components ?? []),
          variable_count: varCount,
          meta_id: tpl.id ?? null,
          fetched_at: new Date(),
        },
      });
      synced++;
    }
    return { ok: true, synced };
  }

  // --- action bindings ---

  async listBindings(): Promise<WaActionBinding[]> {
    const rows = await this.prisma.db.wa_action_bindings.findMany({ orderBy: { action_key: "asc" } });
    return rows.map((r) => ({
      actionKey: r.action_key,
      templateName: r.template_name,
      templateLang: r.template_lang,
      recipientField: r.recipient_field,
      variableMap: safeJson(r.variable_map),
      isEnabled: r.is_enabled,
    }));
  }

  async upsertBinding(input: WaBindingUpsertInput, userId: number): Promise<WaActionBinding> {
    const row = await this.prisma.db.wa_action_bindings.upsert({
      where: { action_key: input.actionKey },
      update: {
        template_name: input.templateName,
        template_lang: input.templateLang,
        recipient_field: input.recipientField ?? null,
        variable_map: JSON.stringify(input.variableMap),
        is_enabled: input.isEnabled,
        updated_by: userId,
        updated_at: new Date(),
      },
      create: {
        action_key: input.actionKey,
        template_name: input.templateName,
        template_lang: input.templateLang,
        recipient_field: input.recipientField ?? null,
        variable_map: JSON.stringify(input.variableMap),
        is_enabled: input.isEnabled,
        updated_by: userId,
      },
    });
    return {
      actionKey: row.action_key,
      templateName: row.template_name,
      templateLang: row.template_lang,
      recipientField: row.recipient_field,
      variableMap: safeJson(row.variable_map),
      isEnabled: row.is_enabled,
    };
  }

  // --- log ---

  // --- settings-page stats ---

  async stats(): Promise<import("@crestly/shared").WaStats> {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [settings, templatesCount, templatesApproved, bindingsActive, sent24h, failed24h] = await Promise.all([
      this.getSettings(),
      this.prisma.db.wa_templates.count(),
      this.prisma.db.wa_templates.count({ where: { status: "APPROVED" } }),
      this.prisma.db.wa_action_bindings.count({ where: { is_enabled: true } }),
      this.prisma.db.wa_message_log.count({ where: { status: "sent",   created_at: { gte: since } } }),
      this.prisma.db.wa_message_log.count({ where: { status: "failed", created_at: { gte: since } } }),
    ]);
    return {
      enabled: settings.enabled,
      phoneNumberIdSet: !!settings.phoneNumberId,
      templatesCount,
      templatesApproved,
      bindingsActive,
      sent24h,
      failed24h,
    };
  }

  async log(limit = 200): Promise<WaLogEntry[]> {
    const rows = await this.prisma.db.wa_message_log.findMany({
      orderBy: { id: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      actionKey: r.action_key,
      templateName: r.template_name,
      toPhone: r.to_phone,
      status: r.status,
      metaMessageId: r.meta_message_id,
      errorMessage: r.error_message,
      variables: safeJson(r.variables_json),
      context: safeJson(r.context_json),
      createdAt: r.created_at ? r.created_at.toISOString() : new Date(0).toISOString(),
    }));
  }
}

function maskToken(t: string): string {
  if (t.length <= 8) return "****";
  return `****${t.slice(-4)}`;
}

function safeJson(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}
