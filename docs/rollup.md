# Rollup Logic and State Machine

ProofHire uses a strict state machine to aggregate evidence from individual verifiers into a final Risk Passport. We do not use "AI magic" to determine verdicts; the LLM is only used for extraction. The final verdict is deterministic and transparent.

## Prohibition on "Safe" Terminology

ProofHire operates in a highly adversarial space where job scammers constantly adapt. As a rule, we **never** label a job as "100% safe," "legit," "genuine," or "scam-free." We can only verify specific claims.

No output string in ProofHire may contain the words "legit", "safe", "genuine", or "100%". 
The best possible outcome is `NO_RED_FLAGS_FOUND` (which means no explicit scam indicators were detected). It does not mean the job is guaranteed to be safe.

## Status Enums

Individual claims return one of four statuses:
- `VERIFIED`: Strong positive evidence found.
- `UNCLEAR`: Conflicting data, minor mismatches, or missing context.
- `NOT_VERIFIED`: No evidence could be found to verify the claim.
- `RISK`: Active red flags (e.g., fee requested, lookalike domain, multiple reports).

## The Rollup State Machine

The `calculateRollup` function takes all `VerifyResult`s and computes a single `RollupResult` (`{ riskLevel, reasons }`). The logic flows strictly in this order:

**Report Validation Rule:**
Reports are heavily guarded against abuse. A "reports" claim only yields a `RISK` status if it has >= 3 reports from *distinct* IPs (reporterHashes). 1-2 reports yield an `UNCLEAR` status ("below the confirmation threshold"). Furthermore, official company domains and the top 1000 free-mail providers (like gmail.com) are excluded from report aggregation entirely to prevent false-flagging known legitimate infrastructure.

1. **UNVERIFIED**
   - Condition: Empty transcript (or `transcriptEmpty` ruleId) OR `system.check_failed` ruleId.

2. **HIGH_RISK**
   - Condition: `payment` claim has `RISK` status.
   
3. **HIGH_RISK**
   - Condition: 2 or more core claims (`payment`, `contact`, `company`, `link`, `role`) have `RISK` status. (Pressure does not count).

4. **CAUTION**
   - Condition: Exactly 1 claim has `RISK` status (including pressure).

5. **NO_RED_FLAGS_FOUND**
   - Condition: `payment`, `company`, `contact`, AND `link` are all exactly `VERIFIED`.

6. **UNVERIFIED**
   - Fallback condition if none of the above match.

This deterministic approach ensures the system never hallucinates a verdict and clearly communicates what is and isn't known.
