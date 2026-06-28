/**
 * Gateway that safely instantiates untrusted RegExp source strings into RegExp.
 *
 * OTA-distributed custom patterns (patterns / tenantRules) are treated as
 * untrusted even when they originate from the console. A malicious or careless
 * RegExp can hang the content script via ReDoS (catastrophic backtracking).
 * Since JS has no runtime timeout for regular expressions, this module defends
 * with:
 *  (1) an upper bound on source length,
 *  (2) static rejection of known dangerous structures such as nested quantifiers,
 *  (3) swallowing exceptions from `new RegExp` (invalid patterns).
 * In addition, the matching side (patterns.ts) caps input text length to keep
 * worst-case execution time bounded.
 *
 * DOM/Chrome-independent. Unit-testable (patternCompiler.test.ts).
 */

/** Maximum length of a RegExp source string. policySchema also gates this once; this is defense in depth. */
export const MAX_PATTERN_SOURCE_LEN = 512;

/**
 * Lightweight detection of dangerous structures. Complete ReDoS detection is
 * impossible, but this rejects the most impactful representative cases:
 * "nested quantifiers" (`(a+)+`, `(a*)*`, `(a+)*`, etc.) and a quantifier
 * immediately following another quantifier. Conservatively rejects a quantified
 * group followed by yet another quantifier.
 */
const NESTED_QUANTIFIER = /\([^)]*[+*][^)]*\)[+*]/;
/** Adjacent quantifiers such as `a**` or `a+*`. */
const ADJACENT_QUANTIFIER = /[+*?]\s*[+*]/;
/** Large bounded quantifiers (e.g. `{1000,}`) can also fuel exponential/polynomial blowup, so cap them. */
const LARGE_BOUNDED_QUANTIFIER = /\{\s*\d{4,}/;

/**
 * Validates an untrusted RegExp source and returns a RegExp if judged safe.
 * Returns null when rejected (the caller falls back to the built-in defaults).
 * @param source RegExp source string (flags not included)
 * @param flags  Fixed flags. Not specifiable by the distributor (prevents state corruption or behavior changes)
 */
export function compileSafePattern(source: string, flags = ''): RegExp | null {
  if (typeof source !== 'string') return null;
  if (source.length === 0 || source.length > MAX_PATTERN_SOURCE_LEN) return null;

  if (
    NESTED_QUANTIFIER.test(source) ||
    ADJACENT_QUANTIFIER.test(source) ||
    LARGE_BOUNDED_QUANTIFIER.test(source)
  ) {
    return null;
  }

  // No eval; only new RegExp. Invalid patterns throw -> null.
  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}
