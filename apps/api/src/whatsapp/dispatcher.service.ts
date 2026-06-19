import { Injectable, Logger } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { WhatsappService } from "./whatsapp.service";
import type { WaActionKey } from "@crestly/shared";

/**
 * App-side WhatsApp dispatcher. Resolves an action key to a bound template,
 * substitutes variables from `context`, hits Meta Cloud API, logs every
 * attempt. Never throws — returns `{ ok, error, logId }`.
 *
 * Mirrors erp/lib/whatsapp.php :: wa_dispatch().
 */
@Injectable()
export class WhatsappDispatcher {
  private readonly logger = new Logger(WhatsappDispatcher.name);

  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly waService: WhatsappService,
  ) {}

  async dispatch(
    actionKey: WaActionKey | string,
    context: Record<string, unknown>,
  ): Promise<{ ok: boolean; error?: string; logId?: number; metaMessageId?: string }> {
    const settings = await this.waService.getSettings(true).catch(() => null);
    if (!settings?.enabled) return { ok: false, error: "WhatsApp is disabled." };
    if (!settings.accessToken || !settings.phoneNumberId) {
      return { ok: false, error: "WhatsApp credentials missing." };
    }

    const binding = await this.prisma.db.wa_action_bindings.findUnique({
      where: { action_key: actionKey },
    });
    if (!binding || !binding.is_enabled) {
      return { ok: false, error: `No active binding for action '${actionKey}'.` };
    }

    const recipientField = binding.recipient_field ?? "phone";
    const recipientRaw = String(context[recipientField] ?? "");
    const to = normalisePhone(recipientRaw, settings.defaultCountry);
    if (!to) {
      return await this.failLog(actionKey, binding.template_name, recipientRaw, context, "Invalid recipient phone");
    }

    // Resolve variables from variable_map → context fields.
    const varMap = safeJson(binding.variable_map);
    const positional: string[] = [];
    for (let i = 1; ; i++) {
      const slot = varMap[String(i)];
      if (slot === undefined) break;
      if (typeof slot === "object" && slot !== null && "field" in (slot as Record<string, unknown>)) {
        positional.push(String(context[(slot as { field: string }).field] ?? ""));
      } else if (typeof slot === "object" && slot !== null && "fixed" in (slot as Record<string, unknown>)) {
        positional.push(String((slot as { fixed: unknown }).fixed));
      } else {
        positional.push(String(slot));
      }
    }

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: binding.template_name,
        language: { code: binding.template_lang },
        components: positional.length > 0
          ? [{ type: "body", parameters: positional.map((v) => ({ type: "text", text: v })) }]
          : undefined,
      },
    };

    // Insert log row first (queued), update with result.
    const log = await this.prisma.db.wa_message_log.create({
      data: {
        action_key: actionKey,
        template_name: binding.template_name,
        to_phone: to,
        status: "queued",
        variables_json: JSON.stringify(positional),
        context_json: JSON.stringify(context),
      },
    });

    try {
      const url = `https://graph.facebook.com/${settings.apiVersion}/${settings.phoneNumberId}/messages`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12_000);
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const body = await r.json().catch(() => ({})) as { messages?: [{ id: string }]; error?: { message: string } };

      if (!r.ok) {
        const err = body?.error?.message ?? `Meta returned ${r.status}`;
        await this.prisma.db.wa_message_log.update({
          where: { id: log.id },
          data: { status: "failed", error_message: err.slice(0, 240) },
        });
        return { ok: false, error: err, logId: log.id };
      }
      const metaId = body.messages?.[0]?.id ?? null;
      await this.prisma.db.wa_message_log.update({
        where: { id: log.id },
        data: { status: "sent", meta_message_id: metaId },
      });
      return { ok: true, logId: log.id, metaMessageId: metaId ?? undefined };
    } catch (e) {
      const err = (e as Error).message ?? "Network error";
      this.logger.warn(`WA dispatch failed for ${actionKey} → ${to}: ${err}`);
      await this.prisma.db.wa_message_log.update({
        where: { id: log.id },
        data: { status: "failed", error_message: err.slice(0, 240) },
      });
      return { ok: false, error: err, logId: log.id };
    }
  }

  private async failLog(
    actionKey: string, templateName: string, toPhone: string,
    context: Record<string, unknown>, error: string,
  ) {
    const log = await this.prisma.db.wa_message_log.create({
      data: {
        action_key: actionKey,
        template_name: templateName,
        to_phone: toPhone,
        status: "failed",
        error_message: error,
        context_json: JSON.stringify(context),
      },
    });
    return { ok: false, error, logId: log.id };
  }
}

function normalisePhone(raw: string, defaultCountry: string): string | null {
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `${defaultCountry}${digits}`;
  if (digits.length >= 11) return digits;
  return null;
}

function safeJson(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}
