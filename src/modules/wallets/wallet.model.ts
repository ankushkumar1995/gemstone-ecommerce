import "server-only";

/**
 * Wallet models.
 *  • wallets          — one balance document per customer. Every change runs in a
 *                       Mongo transaction together with its ledger row.
 *  • wallet_txns      — append-only ledger (unique `key`).
 *  • wallet_recharges — Razorpay top-ups (unique razorpayOrderId / paymentId).
 */

import { Schema, model, models, type Model } from "mongoose";

const WalletSchema = new Schema(
  {
    customerId: { type: String, required: true, unique: true },
    cashPaise: { type: Number, required: true, default: 0, min: 0 },
    promoPaise: { type: Number, required: true, default: 0, min: 0 },
  },
  { collection: "wallets", timestamps: true, versionKey: false },
);

const TxnSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    customerId: { type: String, required: true },
    type: { type: String, enum: ["recharge", "consultation", "refund", "adjustment", "reversal"], required: true },
    cashPaise: { type: Number, required: true },
    promoPaise: { type: Number, required: true },
    cashAfter: { type: Number, required: true },
    promoAfter: { type: Number, required: true },
    ref: { type: String, default: null },
    note: { type: String, required: true, maxlength: 300 },
    actor: { type: String, required: true, maxlength: 120 },
    at: { type: String, required: true },
  },
  { collection: "wallet_txns", versionKey: false },
);
TxnSchema.index({ customerId: 1, at: -1 });
TxnSchema.index({ ref: 1 });

const RechargeSchema = new Schema(
  {
    customerId: { type: String, required: true, index: true },
    amountPaise: { type: Number, required: true, min: 100 },
    bonusPaise: { type: Number, required: true, min: 0 },
    gstPaise: { type: Number, required: true, min: 0 },
    payablePaise: { type: Number, required: true, min: 100 },
    status: { type: String, enum: ["created", "paid", "failed"], default: "created" },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    paidAt: { type: String, default: null },
  },
  { collection: "wallet_recharges", timestamps: true, versionKey: false },
);
RechargeSchema.index({ razorpayOrderId: 1 }, { unique: true, partialFilterExpression: { razorpayOrderId: { $type: "string" } } });
RechargeSchema.index({ razorpayPaymentId: 1 }, { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: "string" } } });

type WalletDoc = { customerId: string; cashPaise: number; promoPaise: number; updatedAt?: Date };
export const WalletModel: Model<WalletDoc> = (models.Wallet as Model<WalletDoc>) ?? model<WalletDoc>("Wallet", WalletSchema);
export const WalletTxnModel = models.WalletTxn ?? model("WalletTxn", TxnSchema);
export const WalletRechargeModel = models.WalletRecharge ?? model("WalletRecharge", RechargeSchema);
