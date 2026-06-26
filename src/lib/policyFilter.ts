/**
 * 属性ベース（SAML/OIDC JWT）のポリシー仕分けロジック（DOM/Chrome 非依存）。
 *
 * エンタープライズ版では、組織が配信する暗号化マスターポリシー
 * （{@link KibaMasterPolicy}）を、ユーザーの JWT claims（email / groups）で
 * 出し分け、その端末・そのユーザーに適用される実効設定をコンパイルする。
 *
 * 外部ライブラリは一切使用しない：
 *  - JWT デコードは `atob` + `JSON.parse` のみ（署名検証は IdP / 別レイヤー責務）。
 *  - 復号は `crypto.subtle`（AES-GCM）のネイティブ API のみ。
 *
 * すべて純粋関数で Chrome API に触れないため、単体テスト可能。
 */

import { importAesGcmKey } from './crypto';
import type { KibaMasterPolicy, KibaSettingsPatch, PolicyClaims, PolicyTarget } from '../types';

/**
 * base64url（JWT で使われる）を標準 base64 へ補正してから `atob` でデコードする。
 * `-`→`+`、`_`→`/` に置換し、長さ 4 の倍数になるよう `=` パディングを補う。
 */
function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
}

/**
 * JWT のペイロード（2 番目のセグメント）を `atob` + `JSON.parse` だけでデコードする。
 * 署名検証は行わない（仕分け用に claims を読むだけ）。
 *
 * トークンが 3 セグメント構成でない、base64 が壊れている、JSON が不正、などは
 * すべて null を返し、呼び出し側は空 claims としてフォールバックできる。
 */
export function decodeJwtPayload(token: string): PolicyClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = base64UrlDecode(parts[1]);
    const payload: unknown = JSON.parse(json);
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return null;
    }
    return payload as PolicyClaims;
  } catch {
    // base64 不正・JSON 不正など。仕分け不能として null を返す。
    return null;
  }
}

/**
 * claims が target に一致するか判定する。emails と groups は OR で評価し、
 * いずれか 1 つでも一致すれば true。両方とも未指定（空ターゲット）は「全員」を
 * 意味し true を返す。email 比較は大文字小文字を無視する。
 */
export function matchTarget(target: PolicyTarget, claims: PolicyClaims): boolean {
  const hasEmails = Array.isArray(target.emails) && target.emails.length > 0;
  const hasGroups = Array.isArray(target.groups) && target.groups.length > 0;

  // 空ターゲットは全員一致。
  if (!hasEmails && !hasGroups) return true;

  // email 一致（完全一致・小文字比較）。
  if (hasEmails && typeof claims.email === 'string') {
    const claimEmail = claims.email.toLowerCase();
    if (target.emails!.some((e) => e.toLowerCase() === claimEmail)) return true;
  }

  // group 一致（いずれか 1 つでも claims.groups に含まれれば一致）。
  if (hasGroups && Array.isArray(claims.groups)) {
    const claimGroups = claims.groups;
    if (target.groups!.some((g) => claimGroups.includes(g))) return true;
  }

  return false;
}

/**
 * AES-GCM で暗号化されたバイナリ blob を復号し、{@link KibaMasterPolicy} を返す。
 *
 * @param buffer 暗号文（GCM 認証タグを含む）の ArrayBuffer。
 * @param rawKey 生の対称鍵バイト列（BYOK）。
 * @param iv     12 バイトの初期化ベクトル。
 *
 * 鍵違い・改竄・IV 不正などの復号失敗は `crypto.subtle` が例外を投げるため、
 * 呼び出し側はそれを「不正ポリシーは適用しない」フォールバックに使える。
 */
export async function decryptPolicyBlob(
  buffer: ArrayBuffer,
  rawKey: Uint8Array<ArrayBuffer>,
  iv: Uint8Array<ArrayBuffer>,
): Promise<KibaMasterPolicy> {
  const key = await importAesGcmKey(rawKey);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, buffer);
  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json) as KibaMasterPolicy;
}

/**
 * マスターポリシーを claims でフィルタし、この端末・このユーザーに適用すべき
 * 設定パッチ（Partial<KibaSettings>）をコンパイルして返す。
 *
 * 評価順：
 *  1. base を土台にする（全員共通）。
 *  2. overrides を配列順に評価し、target にマッチしたものを後勝ちでマージ。
 *
 * 必ず `isManaged: true` を立て（管理下である事実）、`auth.idToken` に渡された
 * idToken を載せる。ローカル専有フィールド（auditLog / oneTimeBypass）はパッチに
 * 含めず、既存ローカル値を保持させる（setSettings の浅マージで温存される）。
 */
export function compileActiveSettings(
  masterPolicy: KibaMasterPolicy,
  claims: PolicyClaims,
  idToken: string,
): KibaSettingsPatch {
  // base を土台にマッチした overrides を順次マージ（後勝ち）。
  let merged: KibaSettingsPatch = { ...masterPolicy.base };
  for (const item of masterPolicy.overrides ?? []) {
    if (matchTarget(item.target, claims)) {
      merged = { ...merged, ...item.value };
    }
  }

  // ローカル専有フィールドはコンソールから来ても取り込まない。
  delete merged.auditLog;
  delete merged.oneTimeBypass;

  // 管理下フラグを必ず立て、idToken を auth へ部分合成する（既存 auth との最終
  // 合成は呼び出し側＝syncManager が行う。ここでは auth は部分のままで返す）。
  return {
    ...merged,
    isManaged: true,
    auth: { ...(merged.auth ?? {}), idToken },
  };
}
