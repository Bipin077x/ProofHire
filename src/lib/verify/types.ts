export type Status = "VERIFIED" | "UNCLEAR" | "NOT_VERIFIED" | "RISK";
export type ClaimKey = "payment" | "contact" | "company" | "role" | "link" | "pressure" | "reports";

export interface Source {
  label: string;
  url: string;
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
