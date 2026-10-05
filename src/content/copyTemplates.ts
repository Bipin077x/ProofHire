export const copyTemplates: Record<string, { evidence: string; why: string }> = {
  // Payment
  "payment.fee_request": {
    evidence: "A fee or deposit was requested.",
    why: "Payment: a fee or deposit was requested."
  },
  "payment.requested": {
    evidence: "A fee or deposit was requested.",
    why: "Payment: a fee or deposit was requested."
  },
  "payment.not_requested": {
    evidence: "No request for payment was found.",
    why: "Payment: no request for payment was found."
  },
  "payment.missing": {
    evidence: "No request for payment was found.",
    why: "Payment: no request for payment was found."
  },
  // Contact
  "contact.freemail": {
    evidence: "A free email service (like Gmail) was used.",
    why: "Contact: a free email service was used instead of a company domain."
  },
  "contact.lookalike": {
    evidence: "The email domain imitates a known company.",
    why: "Contact: the email domain imitates a known company."
  },
  "contact.suspicious_tld": {
    evidence: "The email domain uses a suspicious TLD.",
    why: "Contact: the email domain uses a suspicious TLD."
  },
  "contact.mismatch": {
    evidence: "The email domain does not match the company.",
    why: "Contact: the email domain does not match the company."
  },
  "contact.official_domain": {
    evidence: "The email domain matches the company's official site.",
    why: "Contact: the email domain matches the company's official site."
  },
  "contact.unclear": {
    evidence: "The email domain cannot be verified against the company.",
    why: "Contact: the email domain cannot be verified against the company."
  },
  "contact.missing": {
    evidence: "No contact email or phone was provided.",
    why: "Contact: no contact email or phone was provided."
  },
  // Company
  "company.known_with_proof": {
    evidence: "Named in the post.",
    why: "Company: the post names a known company and links match."
  },
  "company.inferred": {
    evidence: "Inferred from the official domain in the link; the post does not name the company.",
    why: "Company: the company is inferred from the official link domain."
  },
  "company.known_without_proof": {
    evidence: "A real brand is named, but no proof of affiliation is provided.",
    why: "Company: a real brand is named, but no proof of affiliation is provided."
  },
  "company.unknown": {
    evidence: "The company is not recognized in our database.",
    why: "Company: the company is not recognized."
  },
  "company.missing": {
    evidence: "No company name was found.",
    why: "Company: no company name was found."
  },
  // Role
  "role.verified": {
    evidence: "The role matches known positions.",
    why: "Role: the role matches known positions."
  },
  "role.suspicious": {
    evidence: "The role is frequently used in scams (e.g. general Data Entry without specific requirements).",
    why: "Role: the role is frequently used in scams."
  },
  "role.missing": {
    evidence: "No specific role was identified.",
    why: "Role: no specific role was identified."
  },
  "role.unknown": {
    evidence: "Could not verify the role against known positions.",
    why: "Role: could not verify the role."
  },
  // Link
  "link.official_domain": {
    evidence: "Domain matches the company's official site; destination was not checked.",
    why: "Link: the link uses the company's official domain."
  },
  "link.lookalike": {
    evidence: "The address imitates a known company.",
    why: "Link: the address imitates a known company."
  },
  "link.punycode": {
    evidence: "The link uses a misleading punycode domain.",
    why: "Link: the link uses a misleading punycode domain."
  },
  "link.ip_literal": {
    evidence: "The link uses a raw IP address instead of a domain.",
    why: "Link: the link uses a raw IP address."
  },
  "link.blocked_unsafe": {
    evidence: "The link is blocked or unsafe.",
    why: "Link: the link is blocked or unsafe."
  },
  "link.suspicious_tld": {
    evidence: "The link uses a suspicious TLD.",
    why: "Link: the link uses a suspicious TLD."
  },
  "link.shortener_unofficial": {
    evidence: "A short link hides an unofficial destination.",
    why: "Link: a short link hides an unofficial destination."
  },
  "link.unresolved": {
    evidence: "The link could not be reached or destination is hidden.",
    why: "Link: the link could not be reached or destination is hidden."
  },
  "link.form_chat_host": {
    evidence: "The link points to a generic form or chat app, not the official site.",
    why: "Link: the link points to a generic form or chat app."
  },
  "link.unofficial": {
    evidence: "The link does not match the company's official site.",
    why: "Link: the link does not match the company's official site."
  },
  "link.unknown_company": {
    evidence: "Cannot verify if the link is official without knowing the company.",
    why: "Link: cannot verify if the link is official."
  },
  "link.new_domain": {
    evidence: "The link domain was registered very recently.",
    why: "Link: the link domain was registered very recently."
  },
  "link.recent_domain": {
    evidence: "The link domain is relatively new.",
    why: "Link: the link domain is relatively new."
  },
  "link.missing": {
    evidence: "No link was provided.",
    why: "Link: no link was provided."
  },
  // Pressure
  "pressure.high": {
    evidence: "The post uses pressure tactics.",
    why: "Pressure: the post uses pressure tactics."
  },
  "pressure.missing": {
    evidence: "No pressure tactics were found.",
    why: "Pressure: no pressure tactics were found."
  }
};

export function getTemplate(ruleId: string): { evidence: string; why: string } | undefined {
  return copyTemplates[ruleId];
}
