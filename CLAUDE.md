# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

This repository is empty: no idea, stack or code has been chosen yet. Once a stack exists, add its build, lint, test and run commands, plus the architecture overview, to this file.

## Context: PayPal AI Hackathon

This project is an entry for the PayPal AI Hackathon ("Build what's next with PayPal and AI", https://paypalaihackathon.devpost.com/). There are no tracks or set problem statements.

**Hard requirement:** the project must *meaningfully* use **both** PayPal (in the free sandbox environment) and AI. Judging Stage One is a pass/fail check that the project fits the theme and really uses the PayPal APIs/SDKs. PayPal has to be central to the project, not a payment button bolted on.

### Key dates (Pacific Time)
- Submission period: Oct 1, 2026 to **Nov 12, 2026, 12:00 pm PT** (hard deadline; the submission can't be edited after it)
- Judging: Dec 1–15, 2026. Winners are announced around Dec 21, 2026.

### Submission checklist (every item is required)
- A working prototype that judges can run: either complete setup and run instructions in the repo, or a hosted demo URL. Mockups and static prototypes are disqualifying.
- A **public** GitHub/GitLab/Bitbucket repo with all source, assets and run instructions, and an **open-source LICENSE file** that GitHub detects (it shows in the About section).
- The repo README must include any sandbox test account credentials and API keys the judges need, or instructions for getting them.
- A text description of the features, plus a list of the AI tools/models used and how each one is used.
- A demo video **under 3 minutes**, public on YouTube, showing the project working end to end. No third-party trademarks or copyrighted music.
- All materials in English.

### Judging criteria (Stage Two, equally weighted)
Technological Implementation (thorough, non-trivial use of PayPal and AI) · Design (a complete, coherent product, not just a technical PoC) · Potential Impact (a specific real problem for a real audience) · Innovation · Presentation (the video shows the project working end to end and makes clear the problem, the audience and why it matters).

### Prizes worth targeting
Overall prizes are 1st $12k, 2nd $8k and 3rd $5k. There are also $5k awards for Most Creative, Most Impactful, Best Demo Delivery, **Best Use of PayPal + AI** and **Best Use of Agentic Commerce**. Sponsor prizes: AG Grid ($5k/$2k/$1k), APIMatic, Bryntum, Channel3 and Render (credits). Sponsor tools are optional: AG Grid, APIMatic, Astropods, Bryntum, Channel3, Elastic, KERNEL, Postman, Render, Zapier.

### PayPal building blocks
- Core: REST API, JavaScript SDK v6, Checkout, the Developer Dashboard and sandbox accounts.
- Capabilities: Pay Later, Subscriptions, Invoicing, Payouts, Disputes, Donations, Webhooks.
- AI/agents: the PayPal Agent Toolkit (`paypal/agent-toolkit` on GitHub) and the PayPal MCP server. These are the most direct route to "Best Use of Agentic Commerce" and "PayPal + AI".
- Always use sandbox credentials. Keep the client ID and secret in env vars and commit a `.env.example`.
