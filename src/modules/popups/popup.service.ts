/**
 * Popups domain — service. Admin CRUD + storefront read (public popups that
 * are enabled and within their schedule window) + analytics events + form
 * submissions (which also create a Lead so the sales team sees them).
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { getPopupRepository } from "./popup.repository";
import type { Popup, PublicPopup, PopupEvent } from "./popup.types";
import type { CreatePopupDto, UpdatePopupDto, PopupSubmissionDto } from "./popup.schema";

/** Within schedule window + enabled? (visitor-side rules run on the client.) */
function isLive(p: Popup): boolean {
  if (!p.enabled) return false;
  const now = Date.now();
  if (p.startAt && new Date(p.startAt).getTime() > now) return false;
  if (p.endAt && new Date(p.endAt).getTime() < now) return false;
  return true;
}

/** Strip admin-only fields (analytics, name, timestamps) for the storefront. */
function toPublic(p: Popup): PublicPopup {
  return {
    id: p.id,
    type: p.type,
    priority: p.priority,
    content: p.content,
    design: p.design,
    targeting: p.targeting,
    trigger: p.trigger,
    frequencyRule: p.frequencyRule,
  };
}

/** Assemble a full Popup from a validated create DTO, filling defaults. */
function fromCreateDto(dto: CreatePopupDto, priority: number): Popup {
  const now = new Date().toISOString();
  return {
    id: newId("pop"),
    name: dto.name.trim(),
    type: dto.type,
    enabled: dto.enabled ?? true,
    priority: dto.priority ?? priority,
    content: {
      heading: dto.content.heading || undefined,
      body: dto.content.body || undefined,
      image: dto.content.image || undefined,
      html: dto.content.html || undefined,
      couponCode: dto.content.couponCode || undefined,
      emailPlaceholder: dto.content.emailPlaceholder || undefined,
      submitLabel: dto.content.submitLabel || undefined,
      successMessage: dto.content.successMessage || undefined,
      ctas: dto.content.ctas ?? [],
    },
    design: dto.design,
    targeting: dto.targeting,
    trigger: dto.trigger,
    frequencyRule: dto.frequencyRule,
    startAt: dto.startAt || undefined,
    endAt: dto.endAt || undefined,
    analytics: { impressions: 0, clicks: 0, dismissals: 0, submissions: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

/** Build a partial Popup patch from a validated update DTO. */
function fromUpdateDto(dto: UpdatePopupDto): Partial<Popup> {
  const patch: Partial<Popup> = {};
  if (dto.name !== undefined) patch.name = dto.name.trim();
  if (dto.type !== undefined) patch.type = dto.type;
  if (dto.enabled !== undefined) patch.enabled = dto.enabled;
  if (dto.priority !== undefined) patch.priority = dto.priority;
  if (dto.content !== undefined) {
    patch.content = {
      heading: dto.content.heading || undefined,
      body: dto.content.body || undefined,
      image: dto.content.image || undefined,
      html: dto.content.html || undefined,
      couponCode: dto.content.couponCode || undefined,
      emailPlaceholder: dto.content.emailPlaceholder || undefined,
      submitLabel: dto.content.submitLabel || undefined,
      successMessage: dto.content.successMessage || undefined,
      ctas: dto.content.ctas ?? [],
    };
  }
  if (dto.design !== undefined) patch.design = dto.design;
  if (dto.targeting !== undefined) patch.targeting = dto.targeting;
  if (dto.trigger !== undefined) patch.trigger = dto.trigger;
  if (dto.frequencyRule !== undefined) patch.frequencyRule = dto.frequencyRule;
  if (dto.startAt !== undefined) patch.startAt = dto.startAt || undefined;
  if (dto.endAt !== undefined) patch.endAt = dto.endAt || undefined;
  return patch;
}

export const popupService = {
  /** Admin: every popup, highest priority first. */
  async list(): Promise<Result<Popup[]>> {
    const repo = getPopupRepository();
    const all = await repo.findAll();
    all.sort((a, b) => b.priority - a.priority || b.createdAt.localeCompare(a.createdAt));
    return ok(all);
  },

  async getById(id: string): Promise<Result<Popup>> {
    const repo = getPopupRepository();
    const p = await repo.findById(id);
    if (!p) return fail(AppErrors.notFound("Popup not found"));
    return ok(p);
  },

  async create(dto: CreatePopupDto): Promise<Result<Popup>> {
    const repo = getPopupRepository();
    const all = await repo.findAll();
    const maxPriority = all.reduce((m, p) => Math.max(m, p.priority), 0);
    const popup = fromCreateDto(dto, maxPriority + 1);
    return ok(await repo.create(popup));
  },

  async update(id: string, dto: UpdatePopupDto): Promise<Result<Popup>> {
    const repo = getPopupRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Popup not found"));
    const updated = await repo.update(id, fromUpdateDto(dto));
    if (!updated) return fail(AppErrors.notFound("Popup not found"));
    return ok(updated);
  },

  async remove(id: string): Promise<Result<{ id: string }>> {
    const repo = getPopupRepository();
    const removed = await repo.remove(id);
    if (!removed) return fail(AppErrors.notFound("Popup not found"));
    return ok({ id });
  },

  /** Storefront: all live popups as public shape, highest priority first. */
  async liveForPublic(): Promise<Result<PublicPopup[]>> {
    const repo = getPopupRepository();
    const all = await repo.findAll();
    const live = all
      .filter(isLive)
      .sort((a, b) => b.priority - a.priority)
      .map(toPublic);
    return ok(live);
  },

  /** Public: bump an analytics counter. Best-effort; never throws to caller. */
  async recordEvent(id: string, event: PopupEvent): Promise<Result<{ recorded: boolean }>> {
    const repo = getPopupRepository();
    const okFlag = await repo.incEvent(id, event);
    return ok({ recorded: okFlag });
  },

  /**
   * Public: a newsletter/lead popup was submitted. Records the submission
   * analytics event and creates a Lead (source "newsletter", topic marks the
   * popup) so it lands in the admin Leads inbox like the contact form does.
   */
  async submit(dto: PopupSubmissionDto): Promise<Result<{ ok: true }>> {
    const repo = getPopupRepository();
    const popup = await repo.findById(dto.popupId);
    if (!popup) return fail(AppErrors.notFound("Popup not found"));
    if (popup.type !== "newsletter" && popup.type !== "lead") {
      return fail(AppErrors.validation("This popup does not accept submissions"));
    }

    // Create the lead (lazy import to keep modules decoupled).
    const { leadService } = await import("@/modules/leads");
    await leadService.create({
      source: "newsletter",
      name: dto.name?.trim() || "Popup subscriber",
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone?.trim() || undefined,
      topic: `Popup: ${popup.name}`,
      message: dto.message?.trim() || undefined,
    });

    await repo.incEvent(dto.popupId, "submission");
    return ok({ ok: true });
  },
};
