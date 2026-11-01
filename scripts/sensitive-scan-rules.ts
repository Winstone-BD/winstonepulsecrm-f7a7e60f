/**
 * Read-only rules for spotting signing keys and secrets in files.
 * Findings name the file and the rule only — never the matched text.
 */
export type Finding = { file: string; rule: string; severity: "high" | "medium" };

const NAME_RULES: { rule: string; re: RegExp; severity: Finding["severity"] }[] = [
  { rule: "Android/Java keystore", re: /\.(jks|keystore|bks)$/i, severity: "high" },
  { rule: "Certificate bundle with private key", re: /\.(p12|pfx)$/i, severity: "high" },
  { rule: "Private key file", re: /\.(pem|key)$/i, severity: "medium" },
  { rule: "Environment file", re: /(^|\/)\.env(\.[^/]+)?$/i, severity: "medium" },
  { rule: "Local Android properties", re: /(^|\/)(local|keystore|signing)\.properties$/i, severity: "medium" },
];

const CONTENT_RULES: { rule: string; re: RegExp }[] = [
  { rule: "Private key block", re: /-----BEGIN (RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/ },
  { rule: "GitHub token", re: /\b(ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{20,}/ },
  { rule: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { rule: "Stripe secret key", re: /\bsk_live_[A-Za-z0-9]{16,}/ },
  { rule: "Supabase secret key", re: /\bsb_secret_[A-Za-z0-9_-]{16,}/ },
  { rule: "Google service account key", re: /"type"\s*:\s*"service_account"[\s\S]{0,400}"private_key"/ },
  { rule: "Signing password value", re: /(storePassword|keyPassword|KEYSTORE_PASSWORD|KEY_PASSWORD)\s*[=:]\s*["']?(?!(System|providers|project|findProperty|getenv|process|env|secrets|keystoreProperties)\b)[^\s"'$<{(][^\s"'()]{5,}["']?\s*$/m },
];

/** Allowed placeholder/example files that only describe where secrets go. */
const EXAMPLE = /\.(example|sample|template)$/i;

export function checkName(file: string): Finding[] {
  if (EXAMPLE.test(file)) return [];
  return NAME_RULES.filter((r) => r.re.test(file)).map((r) => ({ file, rule: r.rule, severity: r.severity }));
}

export function checkContent(file: string, text: string): Finding[] {
  if (EXAMPLE.test(file)) return [];
  return CONTENT_RULES.filter((r) => r.re.test(text)).map((r) => ({ file, rule: r.rule, severity: "high" as const }));
}
