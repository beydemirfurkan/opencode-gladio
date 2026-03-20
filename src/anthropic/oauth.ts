import { randomBytes, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir, platform } from "node:os";

const execFileAsync = promisify(execFile);

// ── Constants (fallback defaults — overridden by binary introspection) ────────

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback";

const DEFAULT_VERSION = "2.1.80";
const DEFAULT_SCOPES =
  "user:file_upload user:inference user:mcp_servers user:profile user:sessions:claude_code";
const DEFAULT_BETA_HEADERS = [
  "claude-code-20250219",
  "interleaved-thinking-2025-05-14",
  "oauth-2025-04-20",
];

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

// ── Types ────────────────────────────────────────────────────────────────────

type OAuthTokens = {
  access: string;
  refresh: string;
  expires: number;
};

type ClaudeIntrospection = {
  version: string;
  userAgent: string;
  betaHeaders: string[];
  scopes: string;
};

// ── Binary Introspection ─────────────────────────────────────────────────────

const KNOWN_BETA_PREFIXES = [
  "claude-code-",
  "interleaved-thinking-",
  "context-management-",
  "oauth-",
];

async function introspectClaudeBinary(): Promise<ClaudeIntrospection | null> {
  try {
    const { stdout: versionOut } = await execFileAsync(
      "claude",
      ["--version"],
      { timeout: 5000 },
    );
    const version = versionOut.trim().split(" ")[0] || DEFAULT_VERSION;

    const { stdout: whichOut } = await execFileAsync("which", ["claude"], {
      timeout: 3000,
    });
    const binaryPath = whichOut.trim();
    if (!binaryPath) return null;

    const shellSafe = binaryPath.replace(/'/g, "'\\''");

    // Extract beta headers (piped through grep to avoid loading entire strings output)
    const { stdout: betaOut } = await execFileAsync(
      "sh",
      [
        "-c",
        `strings '${shellSafe}' | grep -oE '[a-z]+-[a-z0-9]+-20[0-9]{2}-[0-9]{2}-[0-9]{2}|[a-z]+-20[0-9]{2}-[0-9]{2}-[0-9]{2}|claude-code-[0-9]+' | sort -u`,
      ],
      { timeout: 30_000 },
    );

    const betaHeaders = betaOut
      .trim()
      .split("\n")
      .filter(
        (h) => h && KNOWN_BETA_PREFIXES.some((p) => h.startsWith(p)),
      );
    if (!betaHeaders.some((h) => h.startsWith("oauth-"))) {
      betaHeaders.push("oauth-2025-04-20");
    }

    // Extract scopes
    const { stdout: scopeOut } = await execFileAsync(
      "sh",
      [
        "-c",
        `strings '${shellSafe}' | grep -oE '(user|org):[a-z_:]+' | sort -u`,
      ],
      { timeout: 30_000 },
    );

    const scopeList = scopeOut
      .trim()
      .split("\n")
      .filter(
        (s) =>
          s &&
          !s.includes("this") &&
          !s.endsWith(":") &&
          (s.startsWith("user:") || s.startsWith("org:")),
      );
    const scopes =
      scopeList.length > 0 ? scopeList.join(" ") : DEFAULT_SCOPES;

    return {
      version,
      userAgent: `claude-cli/${version} (external, cli)`,
      betaHeaders,
      scopes,
    };
  } catch {
    return null;
  }
}

// ── Network Utilities ────────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 3,
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, init);
    if (res.status === 429 && i < retries - 1) {
      await new Promise((r) => setTimeout(r, (i + 1) * 2000));
      continue;
    }
    return res;
  }
  return fetch(url, init);
}

// ── PKCE Utilities ───────────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString("base64url").replace(/=+$/, "");
}

function generateVerifier(): string {
  return base64url(randomBytes(32));
}

function generateChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

function createAuthorizationRequest(scopes: string) {
  const verifier = generateVerifier();
  const challenge = generateChallenge(verifier);
  const params = new URLSearchParams({
    code: "true",
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: scopes,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: verifier,
  });
  return { url: `${AUTHORIZE_URL}?${params}`, verifier };
}

function parseAuthCode(raw: string): string {
  const hashIdx = raw.indexOf("#");
  return hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
}

async function exchangeCodeForTokens(
  rawCode: string,
  verifier: string,
  userAgent: string,
): Promise<OAuthTokens> {
  const code = parseAuthCode(rawCode.trim());
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state: verifier,
  });
  const res = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Token exchange failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`,
    );
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + data.expires_in * 1000,
  };
}

// ── Token Refresh ────────────────────────────────────────────────────────────

let refreshInFlight: Promise<OAuthTokens> | null = null;

async function refreshTokens(
  refreshToken: string,
  userAgent: string,
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  const res = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Token refresh failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`,
    );
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + data.expires_in * 1000,
  };
}

function refreshTokensSafe(
  refreshToken: string,
  userAgent: string,
): Promise<OAuthTokens> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshTokens(refreshToken, userAgent).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

// ── Claude Code Credential Reader ────────────────────────────────────────────

async function readKeychainEntry(account?: string): Promise<string | null> {
  try {
    const args = ["find-generic-password", "-s", "Claude Code-credentials"];
    if (account) args.push("-a", account);
    args.push("-w");
    const { stdout } = await execFileAsync("security", args);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function readClaudeCodeCredentials(): Promise<OAuthTokens | null> {
  try {
    let raw: string | null = null;

    if (platform() === "darwin") {
      // Try user-specific entry first (newer Claude Code versions),
      // then fall back to generic entry
      const user = process.env.USER || "";
      if (user) raw = await readKeychainEntry(user);
      if (!raw) raw = await readKeychainEntry("Claude Code");
      if (!raw) raw = await readKeychainEntry();
    } else {
      raw = await readFile(
        join(homedir(), ".claude", ".credentials.json"),
        "utf-8",
      );
    }

    if (!raw) return null;

    const creds = JSON.parse(raw) as {
      claudeAiOauth?: {
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: number;
      };
    };
    const oauth = creds.claudeAiOauth;
    if (!oauth?.accessToken || !oauth?.refreshToken) return null;

    return {
      access: oauth.accessToken,
      refresh: oauth.refreshToken,
      expires: oauth.expiresAt ?? 0,
    };
  } catch {
    return null;
  }
}

// ── Claude CLI Refresh ───────────────────────────────────────────────────────

async function refreshViaClaudeCli(): Promise<OAuthTokens | null> {
  try {
    await execFileAsync(
      "claude",
      ["-p", ".", "--model", "haiku", "hi"],
      { timeout: 30_000, env: { ...process.env, TERM: "dumb" } },
    );
  } catch {
    // CLI might error but still refreshes the token as a side effect
  }
  // Re-read keychain after CLI ran (it should have refreshed)
  return readClaudeCodeCredentials();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isExpiringSoon(expiresAt: number): boolean {
  return Date.now() + REFRESH_BUFFER_MS >= expiresAt;
}

// ── Main Export ──────────────────────────────────────────────────────────────

export async function createAnthropicOAuth() {
  const introspection = await introspectClaudeBinary();

  const userAgent =
    introspection?.userAgent ??
    `claude-cli/${DEFAULT_VERSION} (external, cli)`;
  const betaHeaders = introspection?.betaHeaders ?? DEFAULT_BETA_HEADERS;
  const scopes = introspection?.scopes ?? DEFAULT_SCOPES;

  // Cached access token — injected into x-api-key on every request.
  // Initialize from auth.json or keychain so the very first request has a valid token.
  let cachedToken: string | undefined;
  try {
    const authPath = join(
      process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
      "opencode",
      "auth.json",
    );
    const authData = JSON.parse(await readFile(authPath, "utf-8")) as {
      anthropic?: { access?: string; expires?: number };
    };
    if (authData?.anthropic?.access && authData.anthropic.expires && !isExpiringSoon(authData.anthropic.expires)) {
      cachedToken = authData.anthropic.access;
    }
  } catch {}
  if (!cachedToken) {
    const kc = await readClaudeCodeCredentials();
    if (kc && !isExpiringSoon(kc.expires)) cachedToken = kc.access;
  }

  const loader = async (
    auth: () => Promise<any>,
    _provider: any,
  ): Promise<Record<string, any>> => {
    try {
      const current = await auth();
      if (current?.type !== "oauth" || !current.access || !current.refresh) {
        return current ?? {};
      }

      // Token still fresh — nothing to do
      if (current.expires && !isExpiringSoon(current.expires)) {
        cachedToken = current.access;
        return current;
      }

      // Try refresh_token grant with stored refresh token
      try {
        const refreshed = await refreshTokensSafe(current.refresh, userAgent);
        cachedToken = refreshed.access;
        return { type: "oauth", access: refreshed.access, refresh: refreshed.refresh, expires: refreshed.expires };
      } catch {
        // Refresh token consumed (single-use race) — fall back to keychain
      }

      // Read fresh tokens from Claude Code
      const kc = await readClaudeCodeCredentials();
      if (!kc) return current;

      // Keychain token still fresh
      if (!isExpiringSoon(kc.expires)) {
        cachedToken = kc.access;
        return { type: "oauth", access: kc.access, refresh: kc.refresh, expires: kc.expires };
      }

      // Keychain token also expired — refresh with keychain's refresh token
      try {
        const refreshed = await refreshTokensSafe(kc.refresh, userAgent);
        cachedToken = refreshed.access;
        return { type: "oauth", access: refreshed.access, refresh: refreshed.refresh, expires: refreshed.expires };
      } catch {
        // Keychain refresh token also consumed — run Claude CLI to force update
      }

      const cliFresh = await refreshViaClaudeCli();
      if (cliFresh && !isExpiringSoon(cliFresh.expires)) {
        cachedToken = cliFresh.access;
        return { type: "oauth", access: cliFresh.access, refresh: cliFresh.refresh, expires: cliFresh.expires };
      }

      return current;
    } catch {
      return {};
    }
  };

  return {
    auth: {
      provider: "anthropic" as const,
      loader,
      methods: [
        {
          type: "oauth" as const,
          label: "Claude Code (auto)",
          async authorize() {
            return {
              url: "https://claude.ai",
              instructions: "Detecting Claude Code credentials…",
              method: "auto" as const,
              async callback() {
                let tokens = await readClaudeCodeCredentials();
                if (!tokens) return { type: "failed" as const };

                // Token fresh — use directly
                if (!isExpiringSoon(tokens.expires)) {
                  cachedToken = tokens.access;
                  return { type: "success" as const, access: tokens.access, refresh: tokens.refresh, expires: tokens.expires };
                }

                // Token expired — try refresh_token grant
                try {
                  const refreshed = await refreshTokensSafe(tokens.refresh, userAgent);
                  cachedToken = refreshed.access;
                  return { type: "success" as const, access: refreshed.access, refresh: refreshed.refresh, expires: refreshed.expires };
                } catch {
                  // Refresh token consumed — run Claude CLI to force keychain update
                }

                const fresh = await refreshViaClaudeCli();
                if (fresh && !isExpiringSoon(fresh.expires)) {
                  cachedToken = fresh.access;
                  return { type: "success" as const, access: fresh.access, refresh: fresh.refresh, expires: fresh.expires };
                }

                return { type: "failed" as const };
              },
            };
          },
        },
        {
          type: "oauth" as const,
          label: "Claude Pro/Max (browser)",
          authorize() {
            const { url, verifier } = createAuthorizationRequest(scopes);
            return Promise.resolve({
              url,
              instructions:
                "Open the link above to authenticate with your Claude account. " +
                "After authorizing, you'll receive a code — paste it below.",
              method: "code" as const,
              async callback(code: string) {
                try {
                  const tokens = await exchangeCodeForTokens(
                    code,
                    verifier,
                    userAgent,
                  );
                  return {
                    type: "success" as const,
                    access: tokens.access,
                    refresh: tokens.refresh,
                    expires: tokens.expires,
                  };
                } catch (err) {
                  console.error(
                    "anthropic-oauth: token exchange failed:",
                    err instanceof Error ? err.message : err,
                  );
                  return { type: "failed" as const };
                }
              },
            });
          },
        },
      ],
    },
    config: async (config: any): Promise<void> => {
      const providers = config.provider ?? {};
      if (!providers.anthropic) {
        providers.anthropic = { options: { apiKey: "oauth-managed" } };
        config.provider = providers;
      }
    },
    chatHeaders: async (input: any, output: any): Promise<void> => {
      if (input?.provider?.info?.id !== "anthropic") return;
      // Only set supplementary headers — opencode-anthropic-auth handles Bearer auth via custom fetch
      output.headers["user-agent"] = userAgent;
      output.headers["anthropic-beta"] = betaHeaders.join(",");
      output.headers["x-app"] = "cli";
    },
  };
}
