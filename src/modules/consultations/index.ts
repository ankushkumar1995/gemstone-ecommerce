/** Consultations (chat) module — public API (server-only). */
export { consultService, sweepConsultations, maybeSweepConsultations, type SessionView } from "./consult.service";
export { maskContacts } from "./consult.mask";
export type { ConsultSession, ConsultMessage, ConsultCard, ConsultRole, ConsultStatus, EndReason } from "./consult.types";
export { consultWho } from "./consult.who";
export { waitlistService, offerNext, sweepWaitlists, type WaitEntryView } from "./consult.waitlist";
export { blockService, type BlockRow } from "./consult.blocks";
export { firstChatOffer, type FirstChatOffer } from "./consult.offer";
