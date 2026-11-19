import { webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { checkLicense, parseLicense, signLicenseForTest, recordTrialProjects } from './license';

let keys: CryptoKeyPair;
let jwk: JsonWebKey;
const payload = { v: 1, id: 'test', device: 'device-a', iat: 100, exp: null };
beforeAll(async () => {
  vi.stubGlobal('crypto', webcrypto);
  keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
});
describe('signed licenses', () => {
  it('accepts authentic device-bound licenses', async () => {
    const token = await signLicenseForTest(payload, keys.privateKey);
    expect((await checkLicense(token, 'device-a', 200, jwk)).valid).toBe(true);
    expect((await checkLicense(token, 'device-b', 200, jwk)).reason).toBe('device_mismatch');
  });
  it('rejects tampering and expiry', async () => {
    const token = await signLicenseForTest({ ...payload, exp: 200 }, keys.privateKey);
    expect((await checkLicense(token, 'device-a', 200, jwk)).reason).toBe('expired');
    const changed = await signLicenseForTest({ ...payload, device: 'attacker' }, keys.privateKey);
    expect((await checkLicense(changed.split('.')[0] + '.' + token.split('.')[1], 'attacker', 150, jwk)).reason).toBe('bad_signature');
  });
  it('rejects malformed and missing tokens', async () => {
    expect(parseLicense('bad')).toBeNull();
    expect((await checkLicense(null, 'a')).reason).toBe('missing');
  });
  it('counts unique projects cumulatively, not current inventory', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    expect(recordTrialProjects(['a', 'b'])).toBe(2);
    expect(recordTrialProjects(['b'])).toBe(2);
    expect(recordTrialProjects(['c'])).toBe(3);
    vi.unstubAllGlobals();
  });
});
