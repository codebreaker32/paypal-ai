# Security policy

## Sandbox only

Shelfie runs against the **PayPal sandbox** only (`api-m.sandbox.paypal.com` is fixed in the code). Never use live PayPal credentials with it, and never commit a `.env` file or any key.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's private vulnerability reporting: open the [Security tab](https://github.com/codebreaker32/paypal-ai/security) of https://github.com/codebreaker32/paypal-ai and choose **Report a vulnerability**. Do not open a public issue for a security problem.

Include what you found, the steps to reproduce it, and what an attacker could do with it. You will get a reply on the report.

## In scope

- **The agent door** (`POST /s/<slug>/mcp`) and checkout (`POST /api/checkout/<slug>`): any way for a buyer or an AI agent to set or change a price, total or payee, or to order an item the shop does not sell.
- **Seller accounts and sessions**: logging in, recovery keys, owner links and cookies, and anything that lets one person see or change another seller's shop or orders.
- **Payment state**: an order marked paid, captured or shipped when PayPal says otherwise, or a capture paid to the wrong account.
- Webhook verification, file uploads, and leaks of secrets or personal data.

## Out of scope

- Anything that needs live PayPal credentials (the app never uses them).
- Rate limits on a local development server, and findings that need a compromised machine or a malicious `.env`.
