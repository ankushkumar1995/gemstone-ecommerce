/**
 * Customers domain — service (business logic). Assembles customer records,
 * enforces unique email, appends an activity timeline. Returns Result<T>.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { auditService } from "@/modules/audit";
import { getCustomerRepository } from "./customer.repository";
import type {
  Customer,
  CustomerActivity,
  CustomerAddress,
} from "./customer.types";
import type { CreateCustomerDto, UpdateCustomerDto } from "./customer.schema";

function logEntry(type: CustomerActivity["type"], message: string): CustomerActivity {
  return { id: newId("cact"), at: new Date().toISOString(), type, message, actor: "Admin" };
}

function withAddressIds(addresses: CreateCustomerDto["addresses"]): CustomerAddress[] {
  return (addresses ?? []).map((a) => ({
    id: newId("adr"),
    label: a.label,
    name: a.name || undefined,
    phone: a.phone || undefined,
    line1: a.line1,
    line2: a.line2 || undefined,
    city: a.city,
    state: a.state || undefined,
    postalCode: a.postalCode || undefined,
    country: a.country,
    isDefault: a.isDefault ?? false,
  }));
}

export const customerService = {
  async list(): Promise<Result<Customer[]>> {
    const repo = getCustomerRepository();
    return ok(await repo.findAll());
  },

  async getById(id: string): Promise<Result<Customer>> {
    const repo = getCustomerRepository();
    const c = await repo.findById(id);
    if (!c) return fail(AppErrors.notFound("Customer not found"));
    return ok(c);
  },

  async create(dto: CreateCustomerDto): Promise<Result<Customer>> {
    const repo = getCustomerRepository();
    if (await repo.findByEmail(dto.email)) {
      return fail(AppErrors.validation("A customer with this email already exists"));
    }

    const customer: Customer = {
      id: newId("cus"),
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone?.trim() || undefined,
      avatar: dto.avatar?.trim() || undefined,
      status: dto.status ?? "active",
      tags: dto.tags ?? [],
      notes: dto.notes?.trim() || undefined,
      addresses: withAddressIds(dto.addresses),
      totalOrders: 0,
      totalSpent: 0,
      activity: [logEntry("created", "Account created")],
      createdAt: new Date().toISOString(),
    };
    const createdCustomer = await repo.create(customer);
    await auditService.record({
      action: "create",
      entity: "customer",
      entityId: createdCustomer.id,
      entityLabel: createdCustomer.name,
      summary: `Created customer "${createdCustomer.name}"`,
    });
    return ok(createdCustomer);
  },

  async update(id: string, dto: UpdateCustomerDto): Promise<Result<Customer>> {
    const repo = getCustomerRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Customer not found"));

    if (dto.email && dto.email.toLowerCase() !== existing.email) {
      const clash = await repo.findByEmail(dto.email);
      if (clash && clash.id !== id) {
        return fail(AppErrors.validation("A customer with this email already exists"));
      }
    }

    const patch: Partial<Customer> = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.email !== undefined && { email: dto.email.trim().toLowerCase() }),
      ...(dto.phone !== undefined && { phone: dto.phone || undefined }),
      ...(dto.avatar !== undefined && { avatar: dto.avatar || undefined }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
      ...(dto.notes !== undefined && { notes: dto.notes || undefined }),
      ...(dto.addresses !== undefined && { addresses: withAddressIds(dto.addresses) }),
    };

    const entries: CustomerActivity[] = [];
    if (dto.status !== undefined && dto.status !== existing.status) {
      entries.push(logEntry("status", `Status changed from "${existing.status}" to "${dto.status}"`));
    }
    if (entries.length === 0) entries.push(logEntry("updated", "Profile updated"));
    patch.activity = [...entries, ...existing.activity].slice(0, 50);

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Customer not found"));
    return ok(updated);
  },

  /**
   * Record a confirmed order against a customer: bump lifetime stats and log
   * it on the timeline. Called by the orders module. No-op if the customer
   * doesn't exist (guest orders are allowed).
   */
  async recordOrder(
    customerId: string,
    amount: number,
    orderNumber: string,
    placedAt: string
  ): Promise<void> {
    const repo = getCustomerRepository();
    const c = await repo.findById(customerId);
    if (!c) return;
    await repo.update(customerId, {
      totalOrders: c.totalOrders + 1,
      totalSpent: c.totalSpent + amount,
      lastOrderAt: placedAt,
      activity: [logEntry("order", `Placed order #${orderNumber}`), ...c.activity].slice(0, 50),
    });
  },

  /**
   * Reverse an order's effect on a customer (cancel / refund): decrement
   * lifetime stats and log it. Clamps at 0.
   */
  async revertOrder(
    customerId: string,
    amount: number,
    orderNumber: string
  ): Promise<void> {
    const repo = getCustomerRepository();
    const c = await repo.findById(customerId);
    if (!c) return;
    await repo.update(customerId, {
      totalOrders: Math.max(0, c.totalOrders - 1),
      totalSpent: Math.max(0, c.totalSpent - amount),
      activity: [logEntry("order", `Order #${orderNumber} cancelled/refunded`), ...c.activity].slice(0, 50),
    });
  },

  /** Append a free-text note to the activity timeline. */
  async addNote(id: string, note: string): Promise<Result<Customer>> {
    const repo = getCustomerRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Customer not found"));
    const patch: Partial<Customer> = {
      activity: [logEntry("note", note.trim()), ...existing.activity].slice(0, 50),
    };
    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Customer not found"));
    return ok(updated);
  },

  async remove(id: string): Promise<Result<{ id: string }>> {
    const repo = getCustomerRepository();
    const removed = await repo.remove(id);
    if (!removed) return fail(AppErrors.notFound("Customer not found"));
    return ok({ id });
  },
};
