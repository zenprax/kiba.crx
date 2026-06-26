import { describe, expect, it } from 'vitest';
import type { SsoCredential } from '../types';
import { matchCredential } from './ssoFiller';

const creds: SsoCredential[] = [
  {
    urlMatch: 'github.com/login',
    username: 'kiba-demo@zenprax.com',
    password: 'secret',
    autoSubmit: false,
  },
  {
    urlMatch: 'gitlab.com/users/sign_in',
    username: 'ops@zenprax.com',
    password: 'secret2',
    autoSubmit: true,
  },
];

describe('matchCredential', () => {
  it('matches a credential whose urlMatch is a substring of the URL', () => {
    const result = matchCredential('https://github.com/login?return_to=%2F', creds);
    expect(result?.username).toBe('kiba-demo@zenprax.com');
  });

  it('returns null when no credential applies', () => {
    expect(matchCredential('https://example.com/login', creds)).toBeNull();
  });

  it('returns the first matching credential', () => {
    const result = matchCredential('https://gitlab.com/users/sign_in', creds);
    expect(result?.username).toBe('ops@zenprax.com');
  });

  it('ignores empty urlMatch entries', () => {
    const withEmpty: SsoCredential[] = [
      { urlMatch: '', username: 'x', password: 'y', autoSubmit: false },
    ];
    expect(matchCredential('https://anything', withEmpty)).toBeNull();
  });
});
