/**
 * Email module — repository (templates + logs). Mock (in-memory) and Mongo
 * behind one interface, switched by dataSourceFor("email").
 */

import { dataSourceFor } from "@/core/config/env";
import type { EmailTemplate, EmailLog, EmailEventKey } from "./email.types";
import type { TemplateDoc, LogDoc } from "./email.model";

export interface EmailRepository {
  listTemplates(): Promise<EmailTemplate[]>;
  findTemplate(id: string): Promise<EmailTemplate | null>;
  findTemplateByEvent(event: EmailEventKey): Promise<EmailTemplate | null>;
  createTemplate(t: EmailTemplate): Promise<EmailTemplate>;
  updateTemplate(id: string, patch: Partial<EmailTemplate>): Promise<EmailTemplate | null>;
  removeTemplate(id: string): Promise<boolean>;
  addLog(log: EmailLog): Promise<EmailLog>;
  listLogs(limit?: number): Promise<EmailLog[]>;
}

/* ------------------------------ mock ------------------------------ */
const templates: EmailTemplate[] = [];
const logs: EmailLog[] = [];

const mockRepo: EmailRepository = {
  async listTemplates() {
    return templates.map((t) => ({ ...t }));
  },
  async findTemplate(id) {
    const t = templates.find((x) => x.id === id);
    return t ? { ...t } : null;
  },
  async findTemplateByEvent(event) {
    const t = templates.find((x) => x.event === event && x.enabled);
    return t ? { ...t } : null;
  },
  async createTemplate(t) {
    templates.unshift(t);
    return { ...t };
  },
  async updateTemplate(id, patch) {
    const i = templates.findIndex((x) => x.id === id);
    if (i === -1) return null;
    templates[i] = { ...templates[i], ...patch, updatedAt: new Date().toISOString() };
    return { ...templates[i] };
  },
  async removeTemplate(id) {
    const i = templates.findIndex((x) => x.id === id);
    if (i === -1) return false;
    templates.splice(i, 1);
    return true;
  },
  async addLog(log) {
    logs.unshift(log);
    if (logs.length > 500) logs.length = 500;
    return { ...log };
  },
  async listLogs(limit = 100) {
    return logs.slice(0, limit).map((l) => ({ ...l }));
  },
};

/* ------------------------------ mongo ------------------------------ */
async function models() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { EmailTemplateModel, EmailLogModel } = await import("./email.model");
  await connectMongoose();
  return { EmailTemplateModel, EmailLogModel };
}

const notDeleted = { isDeleted: { $ne: true } };
const isObjectId = (id: string) => /^[a-f0-9]{24}$/i.test(id);

function tplFromDoc(d: TemplateDoc): EmailTemplate {
  const ts = d as unknown as { updatedAt?: Date };
  return {
    id: String(d._id),
    event: d.event as EmailEventKey,
    name: d.name,
    enabled: Boolean(d.enabled),
    subject: d.subject,
    html: d.html,
    text: d.text || undefined,
    updatedAt: ts.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

function logFromDoc(d: LogDoc): EmailLog {
  const ts = d as unknown as { createdAt?: Date };
  return {
    id: String(d._id),
    event: d.event as EmailLog["event"],
    to: d.to,
    subject: d.subject,
    status: d.status as EmailLog["status"],
    provider: d.provider || undefined,
    error: d.error || undefined,
    attempts: (d.attempts ?? []).map((a) => ({
      provider: a.provider ?? "",
      delivered: Boolean(a.delivered),
      skipped: a.skipped || undefined,
      error: a.error || undefined,
    })),
    createdAt: ts.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

const mongoRepo: EmailRepository = {
  async listTemplates() {
    const { EmailTemplateModel } = await models();
    const docs = await EmailTemplateModel.find(notDeleted).sort({ updatedAt: -1 }).lean<TemplateDoc[]>();
    return docs.map(tplFromDoc);
  },
  async findTemplate(id) {
    const { EmailTemplateModel } = await models();
    if (!isObjectId(id)) return null;
    const d = await EmailTemplateModel.findOne({ _id: id, ...notDeleted }).lean<TemplateDoc>();
    return d ? tplFromDoc(d) : null;
  },
  async findTemplateByEvent(event) {
    const { EmailTemplateModel } = await models();
    const d = await EmailTemplateModel.findOne({ event, enabled: true, ...notDeleted })
      .sort({ updatedAt: -1 })
      .lean<TemplateDoc>();
    return d ? tplFromDoc(d) : null;
  },
  async createTemplate(t) {
    const { EmailTemplateModel } = await models();
    const created = await EmailTemplateModel.create({
      event: t.event,
      name: t.name,
      enabled: t.enabled,
      subject: t.subject,
      html: t.html,
      text: t.text ?? "",
    });
    return tplFromDoc(created.toObject() as TemplateDoc);
  },
  async updateTemplate(id, patch) {
    const { EmailTemplateModel } = await models();
    if (!isObjectId(id)) return null;
    const set: Record<string, unknown> = {};
    if (patch.event !== undefined) set.event = patch.event;
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.enabled !== undefined) set.enabled = patch.enabled;
    if (patch.subject !== undefined) set.subject = patch.subject;
    if (patch.html !== undefined) set.html = patch.html;
    if (patch.text !== undefined) set.text = patch.text ?? "";
    const d = await EmailTemplateModel.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: set },
      { new: true, runValidators: true },
    ).lean<TemplateDoc>();
    return d ? tplFromDoc(d) : null;
  },
  async removeTemplate(id) {
    const { EmailTemplateModel } = await models();
    if (!isObjectId(id)) return false;
    const d = await EmailTemplateModel.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    ).lean<TemplateDoc>();
    return Boolean(d);
  },
  async addLog(log) {
    const { EmailLogModel } = await models();
    const created = await EmailLogModel.create({
      event: log.event,
      to: log.to,
      subject: log.subject,
      status: log.status,
      provider: log.provider,
      error: log.error,
      attempts: log.attempts,
    });
    return logFromDoc(created.toObject() as LogDoc);
  },
  async listLogs(limit = 100) {
    const { EmailLogModel } = await models();
    const docs = await EmailLogModel.find({}).sort({ createdAt: -1 }).limit(limit).lean<LogDoc[]>();
    return docs.map(logFromDoc);
  },
};

export function getEmailRepository(): EmailRepository {
  switch (dataSourceFor("email")) {
    case "mongo":
      return mongoRepo;
    case "mock":
    default:
      return mockRepo;
  }
}
