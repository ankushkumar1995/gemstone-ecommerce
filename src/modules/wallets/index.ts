/** Wallets module — public API (server-only). */
export { walletService, CUSTOM_MIN_RUPEES, CUSTOM_MAX_RUPEES } from "./wallet.service";
export type { WalletView } from "./wallet.service";
export { splitDebit } from "./wallet.repository";
export type { ApplyResult } from "./wallet.repository";
export * from "./wallet.types";
