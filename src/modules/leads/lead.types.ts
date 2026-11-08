/**
 * Leads domain — types.
 *
 * A "lead" is a potential customer who submitted the contact form or a service
 * booking enquiry. These are the leads the business wants to capture and
 * follow up on. This file is the single source of truth for the shape of a
 * Lead across the whole module.
 */

export type LeadSource = "contact" | "service" | "newsletter" | "consultation";

export type LeadGender = "male" | "female" | "other";
export type LeadMaritalStatus = "single" | "married" | "divorced" | "widowed" | "separated";

export type LeadStatus = "new" | "contacted" | "converted" | "closed";

/** A persisted lead record. */
export interface Lead {
  id: string;
  source: LeadSource;
  name: string;
  email: string;
  phone?: string;
  /** For contact form: the chosen subject. For service: the service slug. */
  topic?: string;
  message?: string;
  /** Astrology birth details (service enquiries). */
  birth?: {
    date?: string;
    time?: string;
    place?: string;
  };
  /** Consultation requests: about the person asking. */
  gender?: LeadGender;
  maritalStatus?: LeadMaritalStatus;
  /** Consultation requests: the astrologer the customer picked (display name). */
  astrologer?: string;
  status: LeadStatus;
  createdAt: string; // ISO
}

/** Fields accepted when creating a lead (server fills the rest). */
export interface CreateLeadInput {
  source: LeadSource;
  name: string;
  email: string;
  phone?: string;
  topic?: string;
  message?: string;
  birth?: {
    date?: string;
    time?: string;
    place?: string;
  };
  gender?: LeadGender;
  maritalStatus?: LeadMaritalStatus;
  astrologer?: string;
}
