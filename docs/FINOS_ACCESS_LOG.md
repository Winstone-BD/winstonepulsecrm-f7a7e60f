# FinOS access receipts

The IT Console Access section reads existing append-only `audit_logs` for the named FinOS project only. Full IT PIN is required server-side. No new schema, production data writes, or deployment is needed to prepare this viewer.

The prepared endpoint is `POST /api/public/finos/summary`. It stays disabled until `FINOS_SUMMARY_ENABLED=true` and a dedicated shared `FINOS_SUMMARY_SECRET` (at least 32 characters) are securely configured in both apps. No previous accesses have been fabricated or backfilled. The viewer or endpoint source being available does not establish that FinOS is connected or deployed.

When the separate, reviewed FinOS connection is implemented, its server handler must:
1. Authenticate the receiving application; never trust a supplied project ID or a browser session from another app.
2. Compute only the owner-approved financial or work aggregate response.
3. Call `recordFinosSummaryServed` with the verified identity, a server-generated request UUID, summary type, and the exact Dhaka-date period of the response.
4. Await the receipt insert before returning the aggregate. A logging failure aborts the response.

The database-generated UTC timestamp is displayed in Asia/Dhaka. A receipt proves CRM prepared and served a summary, not that the remote client received or a person read it. No customer data, amounts, free text, tokens, IPs or response body enters this log. There is no public or browser log-write endpoint, delete or edit control.

## Request contract

Body: `{"summaryType":"financial","from":"2026-11-01","to":"2026-11-08"}` (or `work`), at most 31 inclusive Dhaka days, at most 2 KB. Unknown fields are rejected.

Headers: `Content-Type: application/json`, `x-finos-project` = the approved FinOS project ID, `x-finos-timestamp` = Unix seconds, `x-finos-signature` = `sha256=` followed by lowercase HMAC-SHA256 hex.

Sign the exact UTF-8 message `POST\n/api/public/finos/summary\n<project-id>\n<timestamp>\n<raw-body>` using the dedicated secret. Timestamps have a five-minute window. This is not a single-use nonce protocol: repeated valid requests within that window may read current aggregates and each successful response gets a fresh receipt. Browser CORS is not enabled; FinOS calls from its server only. No key is included in app code or requests.

Financial summary: approved non-cancelled bookings selected by saved `booked_at`, recorded USD booking amounts, and count without amounts. Booking value is NOT received revenue or a payment claim. Above 10,000 rows the request fails rather than returning truncated amounts.

Work summary: exact counts of leads created, submitted reports by `submitted_at`, and follow-up events created in the period. These are activity counts, not scored KPIs or distinct customers. No per-agent or customer rows leave the handler.

To activate: publish the endpoint only when explicitly requested, then use secure shared-secret forms in Pulse and FinOS and implement the consumer in the FinOS chat. Do not reuse the OS bridge secret, agent tokens or staff PIN. No live reads or writes were performed while preparing this API.