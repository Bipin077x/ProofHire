# Rollup Logic and State Machine

ProofHire uses a strict state machine to aggregate evidence from individual verifiers into a final Risk Passport. We do not use "AI magic" to determine verdicts; the LLM is only used for extraction. The final verdict is deterministic and transparent.

## Prohibition on "Safe" Terminology

ProofHire operates in a highly adversarial space where job scammers constantly adapt. As a rule, we **never** label a job as "100% safe," "legit," "genuine," or "scam-free." We can only verify specific claims.

No output string in ProofHire may contain the words "legit", "safe", "genuine", or "100%". 
The best possible outcome is `NO_FLAGS` (which means no explicit scam indicators were detected). It does not mean the job is guaranteed to be safe.

## Status Enums

Individual claims return one of four statuses:
- `VERIFIED`: Strong positive evidence found.
- `UNCLEAR`: Conflicting data, minor mismatches, or missing context.
- `NOT_VERIFIED`: No evidence could be found to verify the claim.
- `RISK`: Active red flags (e.g., fee requested, lookalike domain).

## The Rollup State Machine

The `calculateRollup` function takes all `VerifyResult`s and computes a single `RollupResult` (`{ riskLevel, reasons }`). The logic flows strictly in this order:

1. **HIGH**
   - Condition: If **ANY** verifier returned `RISK`.
   - Reasons: All evidence strings from the `RISK` results.

2. **CAUTION**
   - Condition (if not HIGH): 
     - **BOTH** `company` and `contact` verifiers returned `NOT_VERIFIED` or `UNCLEAR`. (Core identity is unverified).
     - **OR** any verifier returned `UNCLEAR` with a `ruleId` ending in `.mismatch` or `.unresolved`.
   - Reasons: Descriptions of the mismatches or missing core identity.

3. **UNVERIFIED**
   - Condition (if not HIGH/CAUTION): At least 3 verifiers returned `NOT_VERIFIED`.
   - Reasons: "Too many claims lacked sufficient evidence for verification."

4. **NO_FLAGS**
   - Condition: None of the above hit.
   - Reasons: "No explicit scam indicators or high-risk mismatches were detected."

This deterministic approach ensures the system never hallucinates a verdict and clearly communicates what is and isn't known.
