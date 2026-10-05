export type Status = "VERIFIED" | "UNCLEAR" | "NOT_VERIFIED" | "RISK";
export type ClaimKey = "payment" | "contact" | "company" | "role" | "link" | "pressure" | "reports" | "page";

export interface Source {
  label: string;
  url: string;
  kind?: "official" | "search_result" | "user_post" | "other";
}

export interface VerifyResult {
  claim: ClaimKey;
  status: Status;
  evidence: string;
  sources: Source[];
  nextAction?: string;
  limitations?: string;
  ruleId: string;
}
