/**
 * Email module — service. Template CRUD, send logging, a test-send, and the
 * `renderEventOrNull` helper the per-domain senders use to prefer an
 * admin-edited template over their built-in default.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { sendMail, type MailResult } from "@/core/mailer";
import { getEmailRepository } from "./email.repository";
import { renderTemplate } from "./email.catalog";
import type { EmailTemplate, EmailLog, EmailEventKey } from "./email.types";
import type { CreateTemplateDto, UpdateTemplateDto } from "./email.schema";

export const emailService = {
  /* ---------------- templates ---------------- */
  async listTemplates(): Promise<Result<EmailTemplate[]>> {
    return ok(await getEmailRepository().listTemplates());
  },

  async getTemplate(id: string): Promise<Result<EmailTemplate>> {
    const t = await getEmailRepository().findTemplate(id);
    if (!t) return fail(AppErrors.notFound("Template not found"));
    return ok(t);
  },

  async createTemplate(dto: CreateTemplateDto): Promise<Result<EmailTemplate>> {
    const repo = getEmailRepository();
    const tpl: EmailTemplate = {
      id: newId("etpl"),
      event: dto.event,
      name: dto.name.trim(),
      enabled: dto.enabled ?? true,
      subject: dto.subject.trim(),
      html: dto.html,
      text: dto.text?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    return ok(await repo.createTemplate(tpl));
  },

  async updateTemplate(id: string, dto: UpdateTemplateDto): Promise<Result<EmailTemplate>> {
    const repo = getEmailRepository();
    const patch: Partial<EmailTemplate> = {};
    if (dto.event !== undefined) patch.event = dto.event;
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.enabled !== undefined) patch.enabled = dto.enabled;
    if (dto.subject !== undefined) patch.subject = dto.subject.trim();
    if (dto.html !== undefined) patch.html = dto.html;
    if (dto.text !== undefined) patch.text = dto.text?.trim() || undefined;
    const updated = await repo.updateTemplate(id, patch);
    if (!updated) return fail(AppErrors.notFound("Template not found"));
    return ok(updated);
  },

  async removeTemplate(id: string): Promise<Result<{ id: string }>> {
    const removed = await getEmailRepository().removeTemplate(id);
    if (!removed) return fail(AppErrors.notFound("Template not found"));
    return ok({ id });
  },

  /* ---------------- logs ---------------- */
  async listLogs(limit = 100): Promise<Result<EmailLog[]>> {
    return ok(await getEmailRepository().listLogs(limit));
  },

  /* ---------------- rendering used by senders ---------------- */
  /**
   * If an enabled template exists for `event`, render it with `vars` and return
   * the message; otherwise return null so the caller uses its built-in default.
   * `rawKeys` lists variables whose value is trusted HTML (left unescaped).
   */
  async renderEventOrNull(
    event: EmailEventKey,
    vars: Record<string, string>,
    rawKeys: string[] = [],
  ): Promise<{ subject: string; html: string; text: string } | null> {
    try {
      const tpl = await getEmailRepository().findTemplateByEvent(event);
      if (!tpl) return null;
      return renderTemplate({ subject: tpl.subject, html: tpl.html, text: tpl.text }, vars, rawKeys);
    } catch {
      return null;
    }
  },

  /**
   * Send + record a log in one call. Senders should prefer this over calling
   * the raw mailer, so every send is auditable in the admin log.
   */
  async sendAndLog(
    event: EmailLog["event"],
    msg: { to: string; subject: string; text: string; html?: string },
  ): Promise<MailResult> {
    const result = await sendMail(msg);
    const status: EmailLog["status"] = result.delivered
      ? "delivered"
      : result.attempts.some((a) => a.error)
        ? "failed"
        : "logged";
    try {
      await getEmailRepository().addLog({
        id: newId("elog"),
        event,
        to: msg.to,
        subject: msg.subject,
        status,
        provider: result.provider,
        error: result.error,
        attempts: result.attempts,
        createdAt: new Date().toISOString(),
      });
    } catch {
      /* logging failure must never break the flow */
    }
    return result;
  },

  /** Send a test email (admin "send test" button). */
  async sendTest(to: string): Promise<Result<{ delivered: boolean; provider?: string; detail: string }>> {
    const result = await this.sendAndLog("test", {
      to,
      subject: "Astrounkle — test email",
      text: "This is a test email from your Astrounkle store. If you received it, email delivery is working.",
      html: "<p>This is a <b>test email</b> from your Astrounkle store.</p><p>If you received it, email delivery is working ✅</p>",
    });
    const detail = result.delivered
      ? `Delivered via ${result.provider}.`
      : result.attempts.length === 0
        ? "No email provider is enabled. Enable one and set its secret in .env."
        : "Not delivered: " +
          result.attempts.map((a) => `${a.provider} (${a.skipped ?? a.error ?? "failed"})`).join(", ");
    return ok({ delivered: result.delivered, provider: result.provider, detail });
  },
};
