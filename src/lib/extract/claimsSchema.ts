import { z } from "zod";

export const ClaimsSchema = z.object({
  transcript: z.string(),
  platform: z.string().optional(),
  company: z.string().optional(),
  companySource: z.enum(["named_in_post", "inferred_from_domain"]).optional(),
  role: z.string().optional(),
  recruiterName: z.string().optional(),
  emails: z.array(z.string()).optional(),
  phones: z.array(z.string()).optional(),
  urls: z.array(z.string()).optional(),
  payment: z.object({
    requested: z.boolean(),
    amount: z.string().optional(),
    currency: z.string().optional(),
    wording: z.string().optional(),
    method: z.string().optional()
  }).optional(),
  pressureTactics: z.array(z.string()).optional(),
  stipend: z.string().optional(),
  location: z.string().optional(),
  confidence: z.record(z.number()).optional(),
  extractionMode: z.enum(["regex-only", "llm+regex"]).optional(),
  llmFallback: z.boolean().optional(), // true when LLM failed and regex-only was used
});

export type ClaimsInput = z.infer<typeof ClaimsSchema>;
