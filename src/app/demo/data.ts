import { Scan, Claim } from "@prisma/client";

export type PassportData = Scan & { claims: Claim[] };

const baseDate = new Date("2026-10-01T12:00:00Z");

export const demoData: Record<string, PassportData> = {
  "scam": {
    id: "demo-scam-001",
    createdAt: baseDate,
    verdict: "HIGH_RISK",
    why: "Payment: a fee or deposit was requested.; Contact: email domain (g00gle-careers.in) is a lookalike of official domains.",
    extractionMode: "llm+regex",
    redactedTranscript: "Google is hiring! Send resume to hr@g00gle-careers.in. Refundable deposit of ₹500 required for laptop.",
    indicatorHashes: "[]",
    claims: [
      {
        id: "c1", scanId: "demo-scam-001", key: "payment", status: "RISK",
        evidence: "A fee or deposit was requested.", ruleId: "payment.fee_request",
        nextAction: "Do not pay. Report this post.", limitations: null, sourcesJson: "[]"
      },
      {
        id: "c2", scanId: "demo-scam-001", key: "contact", status: "RISK",
        evidence: "Email domain (g00gle-careers.in) is a lookalike of official domains.", ruleId: "contact.email_lookalike",
        nextAction: "Do not contact. Likely a phishing attempt.", limitations: null, sourcesJson: "[]"
      },
      {
        id: "c3", scanId: "demo-scam-001", key: "company", status: "UNCLEAR",
        evidence: "A real brand is named, but no proof of affiliation is provided.", ruleId: "company.known_without_proof",
        nextAction: "Verify through official channels.", limitations: null, sourcesJson: "[]"
      },
      {
        id: "c4", scanId: "demo-scam-001", key: "pressure", status: "VERIFIED",
        evidence: "No pressure language detected in provided text.", ruleId: "pressure.no_tactics",
        nextAction: "Normal evaluation.", limitations: null, sourcesJson: "[]"
      },
      {
        id: "c5", scanId: "demo-scam-001", key: "link", status: "UNCLEAR",
        evidence: "No link provided.", ruleId: "link.missing",
        nextAction: null, limitations: null, sourcesJson: "[]"
      },
      {
        id: "c6", scanId: "demo-scam-001", key: "role", status: "UNCLEAR",
        evidence: "No specific role was identified.", ruleId: "role.missing",
        nextAction: null, limitations: null, sourcesJson: "[]"
      }
    ]
  },
  "clean": {
    id: "demo-clean-002",
    createdAt: baseDate,
    verdict: "NO_RED_FLAGS_FOUND",
    why: "No explicit red flags were found in the provided claims.",
    extractionMode: "llm+regex",
    redactedTranscript: "We are hiring a Software Engineer at NovaTech (fictional).\nContact hr@novatech-fictional.com for any questions.\nApply at https://careers.novatech-fictional.com.\nNo fee is required.",
    indicatorHashes: "[]",
    claims: [
      {
        id: "c1", scanId: "demo-clean-002", key: "payment", status: "VERIFIED",
        evidence: "No fee wording or payment requests detected.", ruleId: "payment.not_requested",
        nextAction: "Proceed carefully.", limitations: null, sourcesJson: "[]"
      },
      {
        id: "c2", scanId: "demo-clean-002", key: "contact", status: "VERIFIED",
        evidence: "Email domain matches official domain for NovaTech.", ruleId: "contact.official_domain",
        nextAction: "No contradicting evidence found. Still verify through the company's official site.", limitations: null, sourcesJson: JSON.stringify([{ url: "https://careers.novatech-fictional.com", label: "Official Site", kind: "official" }])
      },
      {
        id: "c3", scanId: "demo-clean-002", key: "company", status: "VERIFIED",
        evidence: "Named in the post.", ruleId: "company.known_with_proof",
        nextAction: "No contradicting evidence found. Still verify through the company's official site.", limitations: null, sourcesJson: JSON.stringify([{ url: "https://careers.novatech-fictional.com", label: "Careers Site", kind: "official" }])
      },
      {
        id: "c4", scanId: "demo-clean-002", key: "pressure", status: "VERIFIED",
        evidence: "No pressure language detected in provided text.", ruleId: "pressure.no_tactics",
        nextAction: "Normal evaluation.", limitations: null, sourcesJson: "[]"
      },
      {
        id: "c5", scanId: "demo-clean-002", key: "link", status: "VERIFIED",
        evidence: "Domain matches the company's official site; destination was not checked.", ruleId: "link.official_domain",
        nextAction: null, limitations: null, sourcesJson: JSON.stringify([{ url: "https://careers.novatech-fictional.com", label: "careers.novatech-fictional.com", kind: "official" }])
      },
      {
        id: "c6", scanId: "demo-clean-002", key: "role", status: "VERIFIED",
        evidence: "Role found on official site.", ruleId: "role.verified",
        nextAction: null, limitations: null, sourcesJson: JSON.stringify([{ url: "https://careers.novatech-fictional.com/jobs/123", label: "Software Engineer - NovaTech", kind: "search_result" }])
      }
    ]
  },
  "unknown": {
    id: "demo-unknown-003",
    createdAt: baseDate,
    verdict: "UNVERIFIED",
    why: "Contact: email provided (unknown-startup-xyz.com), but company is unknown.; Company: no company name was found.; Link: no link was provided.; Role: company unknown.",
    extractionMode: "llm+regex",
    redactedTranscript: "Join our unknown startup as a developer. Send email to founder@unknown-startup-xyz.com. We do not ask for any money.",
    indicatorHashes: "[]",
    claims: [
      {
        id: "c1", scanId: "demo-unknown-003", key: "payment", status: "VERIFIED",
        evidence: "No fee wording or payment requests detected.", ruleId: "payment.not_requested",
        nextAction: "Proceed carefully.", limitations: null, sourcesJson: "[]"
      },
      {
        id: "c2", scanId: "demo-unknown-003", key: "contact", status: "UNCLEAR",
        evidence: "Email provided (unknown-startup-xyz.com), but company is unknown.", ruleId: "contact.unknown_company",
        nextAction: "Manually verify the company and domain.", limitations: null, sourcesJson: "[]"
      },
      {
        id: "c3", scanId: "demo-unknown-003", key: "company", status: "UNCLEAR",
        evidence: "No company name was found.", ruleId: "company.missing",
        nextAction: "Ask for the company name.", limitations: null, sourcesJson: "[]"
      },
      {
        id: "c4", scanId: "demo-unknown-003", key: "pressure", status: "VERIFIED",
        evidence: "No pressure language detected in provided text.", ruleId: "pressure.no_tactics",
        nextAction: "Normal evaluation.", limitations: null, sourcesJson: "[]"
      },
      {
        id: "c5", scanId: "demo-unknown-003", key: "link", status: "UNCLEAR",
        evidence: "No link provided.", ruleId: "link.missing",
        nextAction: null, limitations: null, sourcesJson: "[]"
      },
      {
        id: "c6", scanId: "demo-unknown-003", key: "role", status: "UNCLEAR",
        evidence: "Company unknown.", ruleId: "role.unknown_company",
        nextAction: null, limitations: null, sourcesJson: "[]"
      }
    ]
  }
};
