/**
 * 属性ベースのポリシー仕分け（policyFilter）の単体テスト。
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import {
  compileActiveSettings,
  decodeJwtPayload,
  decryptPolicyBlob,
  matchTarget,
} from './policyFilter';
import type { KibaMasterPolicy, PolicyClaims } from '../types';

/** ArrayBuffer 固定のランダムバイト列を生成するヘルパー（WebCrypto 型整合のため）。 */
function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(length)));
}

/** オブジェクトを base64url の JWT セグメント文字列へ変換する。 */
function toBase64Url(obj: unknown): string {
  const json = JSON.stringify(obj);
  // ASCII 範囲の JSON を想定（btoa は Latin-1 のみ）。
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** ヘッダ.ペイロード.署名 の擬似 JWT を組み立てる（署名は検証しないのでダミー）。 */
function makeJwt(payload: unknown): string {
  const header = toBase64Url({ alg: 'RS256', typ: 'JWT' });
  return `${header}.${toBase64Url(payload)}.ZHVtbXlzaWc`;
}

describe('decodeJwtPayload', () => {
  it('正常な JWT のペイロードをデコードする', () => {
    const token = makeJwt({ email: 'a@zenprax.com', groups: ['eng'] });
    expect(decodeJwtPayload(token)).toEqual({ email: 'a@zenprax.com', groups: ['eng'] });
  });

  it('base64url 文字（- と _）を含むペイロードを正しくデコードする', () => {
    // base64 で +,/ が出やすい値を仕込む。
    const payload = { email: 'user+tag@ex.com', note: '??>>>>' };
    const token = makeJwt(payload);
    expect(decodeJwtPayload(token)).toEqual(payload);
  });

  it('3 セグメントでないトークンは null を返す', () => {
    expect(decodeJwtPayload('only.two')).toBeNull();
  });

  it('壊れた base64 ペイロードは null を返す', () => {
    expect(decodeJwtPayload('h.@@@notbase64@@@.s')).toBeNull();
  });

  it('JSON でないペイロード（配列）は null を返す', () => {
    const token = makeJwt([1, 2, 3]);
    expect(decodeJwtPayload(token)).toBeNull();
  });
});

describe('matchTarget', () => {
  const claims: PolicyClaims = { email: 'Dev@Zenprax.com', groups: ['eng', 'admins'] };

  it('空ターゲットは全員一致（true）', () => {
    expect(matchTarget({}, claims)).toBe(true);
    expect(matchTarget({ emails: [], groups: [] }, claims)).toBe(true);
  });

  it('email 完全一致（大文字小文字無視）で true', () => {
    expect(matchTarget({ emails: ['dev@zenprax.com'] }, claims)).toBe(true);
  });

  it('email 不一致で false', () => {
    expect(matchTarget({ emails: ['other@zenprax.com'] }, claims)).toBe(false);
  });

  it('group がいずれか 1 つ一致すれば true', () => {
    expect(matchTarget({ groups: ['admins'] }, claims)).toBe(true);
    expect(matchTarget({ groups: ['nope', 'eng'] }, claims)).toBe(true);
  });

  it('group 不一致で false', () => {
    expect(matchTarget({ groups: ['sales'] }, claims)).toBe(false);
  });

  it('emails と groups は OR（片方一致で true）', () => {
    expect(matchTarget({ emails: ['nobody@x.com'], groups: ['eng'] }, claims)).toBe(true);
  });

  it('claims に email/groups が無くても空ターゲットなら true', () => {
    expect(matchTarget({}, {})).toBe(true);
    expect(matchTarget({ emails: ['a@b.com'] }, {})).toBe(false);
  });
});

describe('compileActiveSettings', () => {
  const idToken = 'tok-123';

  it('base を適用し isManaged:true と idToken を載せる', () => {
    const policy: KibaMasterPolicy = {
      version: 1,
      base: { mode: 'DRY_RUN', ssoEnabled: false },
    };
    const compiled = compileActiveSettings(policy, { email: 'a@b.com' }, idToken);
    expect(compiled.mode).toBe('DRY_RUN');
    expect(compiled.ssoEnabled).toBe(false);
    expect(compiled.isManaged).toBe(true);
    expect(compiled.auth?.idToken).toBe(idToken);
  });

  it('マッチした override が base を後勝ちで上書きする', () => {
    const policy: KibaMasterPolicy = {
      version: 1,
      base: { mode: 'DRY_RUN', maskEnabled: false },
      overrides: [{ target: { groups: ['eng'] }, value: { mode: 'ENFORCE', maskEnabled: true } }],
    };
    const compiled = compileActiveSettings(policy, { groups: ['eng'] }, idToken);
    expect(compiled.mode).toBe('ENFORCE');
    expect(compiled.maskEnabled).toBe(true);
  });

  it('マッチしない override は無視される', () => {
    const policy: KibaMasterPolicy = {
      version: 1,
      base: { mode: 'DRY_RUN' },
      overrides: [{ target: { groups: ['admins'] }, value: { mode: 'ENFORCE' } }],
    };
    const compiled = compileActiveSettings(policy, { groups: ['eng'] }, idToken);
    expect(compiled.mode).toBe('DRY_RUN');
  });

  it('複数 override は配列順で後方が優先される', () => {
    const policy: KibaMasterPolicy = {
      version: 1,
      base: { mode: 'DRY_RUN' },
      overrides: [
        { target: {}, value: { mode: 'ENFORCE' } },
        { target: { groups: ['eng'] }, value: { mode: 'DRY_RUN' } },
      ],
    };
    const compiled = compileActiveSettings(policy, { groups: ['eng'] }, idToken);
    expect(compiled.mode).toBe('DRY_RUN');
  });

  it('ローカル専有フィールド（auditLog/oneTimeBypass）はパッチに含めない', () => {
    const policy: KibaMasterPolicy = {
      version: 1,
      // ポリシーが誤って送ってきても取り込まないことを確認。
      base: { auditLog: [], oneTimeBypass: null } as KibaMasterPolicy['base'],
    };
    const compiled = compileActiveSettings(policy, {}, idToken);
    expect('auditLog' in compiled).toBe(false);
    expect('oneTimeBypass' in compiled).toBe(false);
  });
});

describe('decryptPolicyBlob', () => {
  /** policy を AES-GCM で暗号化し、ArrayBuffer と IV を返すテスト用ヘルパー。 */
  async function encryptPolicy(
    policy: KibaMasterPolicy,
    rawKey: Uint8Array<ArrayBuffer>,
  ): Promise<{ buffer: ArrayBuffer; iv: Uint8Array<ArrayBuffer> }> {
    const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, [
      'encrypt',
    ]);
    const iv = randomBytes(12);
    const plaintext = new TextEncoder().encode(JSON.stringify(policy));
    const buffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    return { buffer, iv };
  }

  it('暗号化→復号のラウンドトリップでマスターポリシーに戻る', async () => {
    const rawKey = randomBytes(32);
    const policy: KibaMasterPolicy = { version: 1, base: { mode: 'ENFORCE' } };
    const { buffer, iv } = await encryptPolicy(policy, rawKey);

    await expect(decryptPolicyBlob(buffer, rawKey, iv)).resolves.toEqual(policy);
  });

  it('誤った鍵では復号に失敗して例外を投げる', async () => {
    const rawKey = randomBytes(32);
    const wrongKey = randomBytes(32);
    const policy: KibaMasterPolicy = { version: 1, base: {} };
    const { buffer, iv } = await encryptPolicy(policy, rawKey);

    await expect(decryptPolicyBlob(buffer, wrongKey, iv)).rejects.toThrow();
  });
});
