export const copy = {
  hero: {
    headline: "Before you apply. Before you pay. Verify.",
    subtitle: "Upload a job or internship post and see which claims are backed by independent evidence.",
  },
  privacy: {
    note: "Your screenshot or text is sent to an AI service to read the post. We don't store screenshots. Phone numbers, emails and UPI IDs are redacted before anything is saved. If you submit a link, its address is sent to a web-reading service (Tavily) so we can read the page. Company and role names may be sent to a search service. We never send phone numbers, emails or screenshots to these services."
  },
  howItWorks: {
    limits: [
      "We never guarantee an outcome; we show the evidence so you can decide.",
      "Not found in the sources we checked is not the same as fake. Many real internships are not publicly listed."
    ],
    checks: [
      { name: "Fee Wording", desc: "Checks for language requesting upfront payment or deposits." },
      { name: "Link & Domain", desc: "Resolves links to detect shorteners and checks if they lead to an official company site." },
      { name: "Contact Verification", desc: "Compares email domains against known official domains." },
      { name: "Community Reports", desc: "Cross-references indicators against reported scams." },
      { name: "Domain Registration", desc: "Checks domain age via RDAP to spot recently created domains." }
    ],
    steps: [
      { title: "Capture", desc: "Upload a screenshot, link or text of the suspicious post." },
      { title: "Extract", desc: "AI pulls out the key claims (contact, payment, role) securely." },
      { title: "Verify", desc: "We run background checks across multiple data sources." },
      { title: "Explain", desc: "You get a transparent Evidence Passport showing what we found." }
    ]
  },
  trust: [
    "Evidence-first",
    "Explainable",
    "Decision support, not a guarantee"
  ],
  tabs: {
    linkNote: "We check where the link goes. We can't read posts behind a login. Upload a screenshot for full analysis."
  }
};
