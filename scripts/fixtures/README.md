# Fixture Files

## Provenance

| File | First appeared | Notes |
|------|---------------|-------|
| gmail.txt | 264f2d8 (phase 1) | Original |
| infosys.txt | 264f2d8 (phase 1) | Original |
| shortener.txt | 264f2d8 (phase 1) | Original |
| 1_scam_data_entry.txt | 130feb4 (phase 4) | Renamed to 09_sample.txt in 02a4326 |
| 2_legit_software_engineer.txt | 130feb4 (phase 4) | Renamed to 02_legit_software_engineer.txt in 02a4326 |
| 3_scam_fake_google.txt | 130feb4 (phase 4) | Renamed to 03_scam_fake_google.txt in 02a4326 |
| 4_legit_startup.txt | 130feb4 (phase 4) | Renamed to 04_legit_startup.txt in 02a4326 |
| 01_simple_scam.txt | c99253c (gate fixes) | Rewritten in 02a4326; RESTORED to original c99253c content |
| 02_legit_email.txt | c99253c (gate fixes) | DELETED in 02a4326; RESTORED here from c99253c |
| 03_mixed_signals.txt | c99253c (gate fixes) | Renamed to 07_mixed_signals.txt in 02a4326 |
| 04_obfuscated_links.txt | c99253c (gate fixes) | Renamed to 08_obfuscated_links.txt in 02a4326 |
| sample.txt | c99253c (gate fixes) | Deleted in 02a4326; same content as 09_sample.txt |
| 05_simple_scam.txt | 02a4326 | New file; same content as original c99253c 01_simple_scam.txt |
| 06_legit_email.txt | 02a4326 | New file; set to original 02_legit_email.txt content (restored) |
| 07_mixed_signals.txt | 02a4326 | Renamed from 03_mixed_signals.txt; content unchanged |
| 08_obfuscated_links.txt | 02a4326 | Renamed from 04_obfuscated_links.txt; content unchanged |
| 09_sample.txt | 02a4326 | Renamed from 1_scam_data_entry.txt; content unchanged |

## What changed in 06_legit_email and why

In commit `02a4326`, the original `02_legit_email.txt` (which contained a Google Careers URL response
with no explicit email address) was deleted. A new `06_legit_email.txt` was created with different
Microsoft-based content (hr@microsoft.com + https://careers.microsoft.com). This was done to make
the e2e test produce NO_RED_FLAGS_FOUND (all 4 core claims VERIFIED).

**This was wrong**: the fixture was edited to match the test expectation instead of the test being
written to match the fixture.

**Restored**: `06_legit_email.txt` now contains the original `02_legit_email.txt` content
(Google Careers URL, no explicit email). The e2e test expectation is fixed to match:
UNVERIFIED (contact UNCLEAR because no email/phone), no RISK rows, payment/company/link VERIFIED.
