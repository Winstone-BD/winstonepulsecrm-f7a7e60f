# FinOS access receipts

The IT Console Access section reads existing append-only `audit_logs` for the named FinOS project only. Full IT PIN is required server-side. No new schema, production data writes, or deployment is needed to prepare this viewer.

There is currently no authenticated FinOS summary-serving endpoint. No previous accesses have been fabricated or backfilled. The viewer being available does not establish that FinOS is connected.

When the separate, reviewed FinOS connection is implemented, its server handler must:
1. Authenticate the receiving application; never trust a supplied project ID or a browser session from another app.
2. Compute only the owner-approved financial or work aggregate response.
3. Call `recordFinosSummaryServed` with the verified identity, a server-generated request UUID, summary type, and the exact Dhaka-date period of the response.
4. Await the receipt insert before returning the aggregate. A logging failure aborts the response.

The database-generated UTC timestamp is displayed in Asia/Dhaka. A receipt proves CRM prepared and served a summary, not that the remote client received or a person read it. No customer data, amounts, free text, tokens, IPs or response body enters this log. There is no public or browser log-write endpoint, delete or edit control.