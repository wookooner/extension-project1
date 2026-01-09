// --- Chapter 4: Activity Levels ---
// Role: Official Taxonomy Definition
// These enums represent the "depth" of interaction.

export enum ActivityLevel {
  VIEW = "view",               // Passive consumption
  ACCOUNT = "account",         // Login, settings, profile
  UGC = "ugc",                 // Creation, editing, posting
  TRANSACTION = "transaction"  // Checkout, payment, high-risk actions
}

export type ActivityConfidence = "low" | "medium" | "high";

export interface ActivityEstimation {
  level: ActivityLevel;
  confidence: ActivityConfidence;
  reasons: string[]; // List of SIGNAL_CODES that led to this conclusion
}