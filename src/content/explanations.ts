export const explanations: Record<string, string> = {
  // Payment
  "payment.fee_request": "Authentic employers never ask candidates to pay for training, equipment, background checks, or securing a job. This is a common tactic in employment scams to steal money.",
  "payment.requested": "A request for a fee or deposit was found. Authentic job offers do not require upfront payments.",
  "payment.not_requested": "No requests for payment were found in the text. This is expected for authentic opportunities.",
  "payment.missing": "No fee wording or payment requests were found.",
  "payment.missing_text": "No text was provided to analyze for payment requests.",
  "payment.fee_wording": "Language suggesting a fee or financial obligation was detected. Authentic employers do not ask candidates to pay.",
  "payment.upi_request": "A UPI ID or similar instant-payment handle was found. Employers never ask candidates to send money via UPI.",
  "payment.no_fee": "No fee wording or payment requests were detected in the text.",

  // Contact
  "contact.freemail": "While some very small businesses use free email addresses (like @gmail.com or @yahoo.com), established companies use their own official domains. Scammers frequently use free email providers because they are easy and free to set up.",
  "contact.lookalike": "Scammers often register domains that look very similar to real company domains (e.g., microsooft.com instead of microsoft.com) to trick applicants into thinking they are communicating with the real company.",
  "contact.suspicious_tld": "The email uses a top-level domain (like .xyz or .top) that is frequently associated with spam or disposable addresses, rather than standard commercial domains.",
  "contact.mismatch": "The email domain provided does not match the known official domain of the company. Authentic recruiters use their company's email addresses.",
  "contact.official_domain": "The email address uses the company's confirmed official domain. This strongly suggests the contact is authentic.",
  "contact.unclear": "We could not definitively verify if the email domain belongs to the claimed company.",
  "contact.missing": "No contact information was provided in the post. Authentic postings usually provide a way to apply or contact the recruiter.",
  "contact.placeholder": "The email or contact information appears to be a placeholder or example address, not a real contact.",
  "contact.email_official": "The email address uses the company's confirmed official domain. This strongly suggests the contact is authentic.",
  "contact.freemail_known_brand": "A free email service (like Gmail or Yahoo) is being used to represent a known brand. Real companies use their own email domains for recruitment.",
  "contact.email_lookalike": "The email domain closely resembles an official company domain but is not an exact match. This is a common phishing technique.",
  "contact.unknown_company": "The company is not in our database, so we cannot verify if this email domain belongs to them.",
  "contact.phone_only": "Only a phone number was provided, with no email address. While not inherently suspicious, authentic companies typically provide official email contact.",

  // Company
  "company.known_with_proof": "The post names a known company and provides matching contact details or links, adding credibility to the claim.",
  "company.inferred": "The company name was not explicitly stated, but the provided link points to a known company's official site.",
  "company.known_without_proof": "A known brand is mentioned, but the post lacks verifiable links or official contact emails. Scammers frequently impersonate large, well-known companies to appear authentic.",
  "company.unknown": "The company name is not in our database. Limited public evidence does not mean the company is fake, but you should verify it through other channels.",
  "company.missing": "No company name could be identified in the post.",

  // Role
  "role.verified": "The job title matches positions known to be offered by this company.",
  "role.suspicious": "This role (like general Data Entry or Package Forwarding) is frequently used in employment scams because it requires few qualifications and appeals to a broad audience.",
  "role.missing": "No specific job title or role could be identified.",
  "role.unknown": "We could not verify if this role is currently offered. Not found in the sources we checked is not the same as fake. Many real internships are not publicly listed.",
  "role.not_found": "We could not verify if this role is currently offered. Not found in the sources we checked is not the same as fake. Many real internships are not publicly listed.",
  "role.unknown_company": "The company is unknown, so we cannot verify whether this role is authentic.",
  "role.no_official_domain": "No official domain is known for this company, so we cannot search their careers page.",
  "role.found": "The role was found on the company's official site or a trusted source.",
  "role.no_api_key": "Role verification requires a search API key that is not configured. The role could not be checked against external sources.",
  "role.error": "An error occurred while trying to verify this role. The check could not be completed.",

  // Link
  "link.official_domain": "The link points directly to the company's verified official domain. (Note: We checked the domain, not the specific page).",
  "link.verified": "The link has been verified and points to an expected domain.",
  "link.lookalike": "The link uses a domain that visually imitates a real company's domain to deceive users.",
  "link.punycode": "The link uses special characters to look like a standard domain (homograph attack), a common phishing tactic.",
  "link.punycode_unknown": "The link uses punycode encoding and the company is unknown, making verification impossible.",
  "link.ip_literal": "The link points directly to a raw IP address instead of a domain name, which is highly unusual for authentic businesses.",
  "link.blocked_unsafe": "The link was blocked or flagged as unsafe by our verification tools.",
  "link.suspicious_tld": "The link uses a top-level domain frequently associated with spam or disposable sites.",
  "link.shortener_unofficial": "The link uses a URL shortener (like bit.ly) that obscures its final destination, which turned out not to be the official company site.",
  "link.unresolved": "We could not reach the link's destination or it was hidden behind multiple redirects.",
  "link.form_chat_host": "The link points to a generic form builder (like Google Forms) or a chat application (like Telegram/WhatsApp) rather than an official company application portal.",
  "link.unofficial": "The link does not match the company's known official domain.",
  "link.unknown_company": "Because the company is unknown, we cannot verify if this link belongs to their official site.",
  "link.new_domain": "The domain was registered very recently. Scammers often use brand new domains for short-lived campaigns.",
  "link.recent_domain": "The domain is relatively new. While some startups have new domains, it warrants caution.",
  "link.missing": "No links were found in the post.",

  // Pressure
  "pressure.high": "The post uses high-pressure language (e.g., 'guaranteed job', 'limited seats', 'act now'). Scammers use false urgency to force quick decisions and prevent you from researching the offer.",
  "pressure.missing": "No pressure tactics or artificial urgency were detected.",
  "pressure.missing_text": "No text was provided to analyze for pressure tactics.",
  "pressure.tactics_found": "The post uses high-pressure language (e.g., 'guaranteed job', 'limited seats', 'act now'). Scammers use false urgency to force quick decisions and prevent you from researching the offer.",
  "pressure.no_tactics": "No pressure tactics or artificial urgency were detected.",

  // System
  "system.check_failed": "An internal error prevented this check from completing. This does not indicate a problem with the post itself.",

  // Reports
  "reports.known_indicator": "Contact details or links in this post have been reported as scams by multiple distinct users.",
  "reports.unconfirmed": "This post contains details that have been reported by users, but the number of reports has not yet reached our confirmation threshold.",

  // Fallback
  "fallback": "This check was performed, but no detailed explanation is available for this specific rule.",

  // Page
  "page.sensitive_request": "The page asks for sensitive personal or financial information (like Aadhaar, PAN, bank details) which authentic employers do not request upfront.",
  "page.payment_request": "The page contains language about fees, payment gateways, or UPI transfers. Authentic jobs never ask you to pay.",
  "page.role_listed_official": "The specific role was found on the page text, which is hosted on an official domain.",
  "page.mismatch": "The page content does not match the expected company or role details.",
  "page.unreadable": "The page content could not be read; this does not mean the link is unsafe.",
  "page.missing_link": "No link was provided to check the page content."
};

