# ProofHire

ProofHire helps job seekers assess whether a job posting or recruiter message may
be a scam. It extracts claims from submitted text, checks available evidence, and
shows a verdict with explanations and suggested next steps.

> **Use as a screening aid, not a guarantee.** Results depend on the submitted
> content and the availability and quality of external sources. Verify important
> details independently before sharing personal information, paying fees, or
> accepting an offer.

## Features

- Analyze pasted job descriptions, recruiter messages, or links.
- Review claims about the role, company, contact details, and links.
- See evidence, limitations, and next steps alongside the result.
- Explore sample analyses, the how-it-works guide, and recent local history.
- Redact sensitive indicators and use privacy-conscious verification checks.

## Requirements

- Node.js 18.17 or newer
- npm
- An Anthropic API key for AI-assisted claim extraction
- Optional search-provider API keys for live evidence checks

## Getting started

```powershell
npm install
Copy-Item .env.example .env
```

Add your API keys to `.env`, then start the development server:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

Copy `.env.example` to `.env` and set the values you need:

| Variable | Required | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes for AI extraction | Anthropic API key used to extract claims from submitted content. |
| `ANTHROPIC_MODEL` | No | Model identifier used for extraction. |
| `SEARCH_PROVIDER` | No | Search provider selection; `tavily` is configured in the example. |
| `PAGE_PROVIDER` | No | Page evidence provider selection; `tavily` is configured in the example. |
| `TAVILY_API_KEY` | No | Enables Tavily-backed search and page evidence. |
| `TAVILY_DAILY_CREDIT_CAP` | No | Daily Tavily usage limit; defaults to `200`. |
| `BRAVE_API_KEY` | No | Enables Brave search where configured. |
| `DATABASE_URL` | No | SQLite connection string for Prisma, for example `file:./dev.db`. |
| `INDICATOR_SALT` | No | Secret salt for hashing indicators; set a unique random value in production. |
| `TRUSTED_PROXY` | No | Set to `true` only when the deployment is behind a trusted proxy. |

Do not commit `.env` or put API keys in source code. The repository ignores local
environment files; `.env.example` contains placeholders only.

## Development

```powershell
npm run dev          # Run the development server
npm run build        # Create a production build
npm start            # Serve the production build
npm test -- --run    # Run the test suite once
npx tsc --noEmit     # Type-check
npm run lint         # Run ESLint
npm run verify       # Run tests, type-check, and lint
```

For database schema changes, configure `DATABASE_URL` and use the Prisma
migrations under `prisma/migrations`.

## Privacy and limitations

Only submit content you are comfortable processing with the configured services.
When API keys are configured, some submitted text or extracted claims may be
sent to those providers to perform extraction or verification. Review their
privacy policies and your deployment configuration before use. ProofHire's
results are informational and can be incomplete or incorrect; they are not a
substitute for your own research.
