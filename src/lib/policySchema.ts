/**
 * Validation of the decrypted policy JSON delivered by the console
 * (no DOM/Chrome dependency).
 *
 * Narrows the post-decryption `unknown` down to a safely mergeable
 * `Partial<KibaSettings>`. Validation uses a declarative Zod schema and never
 * uses `any`. Malformed structures are discarded wholesale (returns null; the
 * caller keeps the local defaults).
 *
 * Important: credentials (ssoCredentials travel a separate path —
 * credentialBroker) and the locally-owned auditLog are excluded from the merge.
 * They are not ingested even if the console sends them by mistake; since the
 * schema does not declare those keys, Zod's default (strip unknown keys) drops
 * them automatically.
 */

import { z } from 'zod';
import type { KibaAuthState, KibaSettings, TenantRuleDef, TenantWhitelistEntry } from '../types';

/**
 * Upper bound for an untrusted RegExp source string (first-line ReDoS
 * mitigation). At instantiation time patternCompiler performs the structural
 * validation; this is only a coarse gate.
 */
const MAX_PATTERN_LEN = 512;
/** Upper bound on OTA-delivered custom patterns (per kind). */
const MAX_CUSTOM_PATTERNS = 64;
/** Upper bound on OTA-delivered tenant rules. */
const MAX_TENANT_RULES = 128;

const patternSourceSchema = z.string().min(1).max(MAX_PATTERN_LEN);

/**
 * Policy patch. A shallow subset of KibaSettings, but `auth` allows partial
 * updates so it is expressed as Partial<KibaAuthState> (the caller merges it
 * into the existing auth).
 */
export type PolicyPatch = Partial<Omit<KibaSettings, 'auth'>> & {
  auth?: Partial<KibaAuthState>;
};

/* ------------------------------------------------------------------ *
 * Zod schema definitions
 *
 * The source of truth for the types is the interfaces in src/types. Here we only
 * define schemas to *validate* them; to avoid double-maintenance we do not
 * regenerate types via z.infer (each schema is structurally a subset of the
 * corresponding top-level interface).
 * ------------------------------------------------------------------ */

const tenantProviderSchema = z.enum(['slack', 'google', 'github', 'unknown']);
const kibaModeSchema = z.enum(['ENFORCE', 'DRY_RUN']);
const offlineStrategySchema = z.enum(['LOCKDOWN', 'FAIL_OPEN']);

/** A single tenant whitelist entry. */
const tenantEntrySchema = z.object({
  provider: tenantProviderSchema,
  tenantId: z.string(),
  label: z.string(),
}) satisfies z.ZodType<TenantWhitelistEntry>;

/** Per-feature DRY_RUN override map. Only the feature keys that arrive are kept. */
const featureModesSchema = z
  .object({
    paste: kibaModeSchema.optional(),
    file: kibaModeSchema.optional(),
    tenant: kibaModeSchema.optional(),
    download: kibaModeSchema.optional(),
  })
  .strip();

/**
 * OTA-delivered custom patterns. RegExp sources are bounded by length and count
 * (first-line ReDoS mitigation; structural validation is handled by
 * patternCompiler at instantiation time).
 */
const customPatternsSchema = z
  .object({
    danger: z.array(patternSourceSchema).max(MAX_CUSTOM_PATTERNS).optional(),
    secrets: z
      .array(z.object({ label: z.string().min(1), pattern: patternSourceSchema }))
      .max(MAX_CUSTOM_PATTERNS)
      .optional(),
  })
  .strip();

/** A single OTA-delivered tenant extraction rule. */
const tenantRuleSchema = z.object({
  provider: z.string().min(1),
  hostMatch: z.string().min(1),
  extract: z.object({
    source: z.enum(['pathname', 'hostname']),
    regex: patternSourceSchema,
    group: z.number().int().nonnegative(),
  }),
}) satisfies z.ZodType<TenantRuleDef>;

/**
 * Partial-update schema for auth. Only the subfields that arrive
 * (offlineStrategy / ssoTtlExpiresAt) are kept. idToken is never received via
 * the console (not defined here).
 */
const authPatchSchema = z
  .object({
    offlineStrategy: offlineStrategySchema.optional(),
    ssoTtlExpiresAt: z.number().nullable().optional(),
  })
  .strip();

/**
 * Validation schemas for each top-level field (excluding auth). Calling
 * safeParse per field reproduces the patch semantics of the old `typeof` guards:
 * a type mismatch in one field does not prevent the others from being adopted.
 *
 * tenantWhitelist validates the whole array with a single schema, so if even one
 * entry is invalid the whole field fails and is dropped from the result
 * (equivalent to the old every()).
 */
const fieldSchemas = {
  antiClickFixEnabled: z.boolean(),
  maskEnabled: z.boolean(),
  ssoEnabled: z.boolean(),
  auditExtensionsEnabled: z.boolean(),
  mode: kibaModeSchema,
  tenantWhitelist: z.array(tenantEntrySchema),
  networkFilterEnabled: z.boolean(),
  // --- New fields the feature branches deliver over OTA (registered together on the base branch) ---
  featureModes: featureModesSchema,
  customPatterns: customPatternsSchema,
  tenantRules: z.array(tenantRuleSchema).max(MAX_TENANT_RULES),
  downloadGaterEnabled: z.boolean(),
  downloadAllowlist: z.array(z.string()),
  screenShareAuditEnabled: z.boolean(),
} as const;

/** Returns a shallow copy with keys whose value is undefined removed. */
function pruneUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

/**
 * Validates a decrypted policy payload and returns a mergeable patch. Returns
 * null if the structure itself is invalid (e.g. not an object). Individual
 * fields are adopted only when their type matches; non-matching fields are
 * silently discarded (fail-safe).
 */
export function parsePolicyPayload(raw: unknown): PolicyPatch | null {
  // Parse loosely overall: null if the top level is a non-object, otherwise
  // safeParse each field individually and adopt only those that pass. This
  // avoids discarding the whole payload over one field's type mismatch while
  // reproducing the old implementation's behaviour.
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const source = raw as Record<string, unknown>;
  const patch: PolicyPatch = {};

  // Validate each field against its schema and adopt only type-matching ones.
  for (const [key, schema] of Object.entries(fieldSchemas)) {
    if (!(key in source)) continue;
    const result = schema.safeParse(source[key]);
    if (result.success) {
      // key is a fieldSchemas key, so it matches the corresponding PolicyPatch property.
      (patch as Record<string, unknown>)[key] = result.data;
    }
  }

  // auth is a partial update. Adopt only the valid subfields that arrive; omit if none.
  if ('auth' in source) {
    const result = authPatchSchema.safeParse(source.auth);
    if (result.success) {
      const auth = pruneUndefined(result.data);
      if (Object.keys(auth).length > 0) patch.auth = auth;
    }
  }

  return patch;
}
