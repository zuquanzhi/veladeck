import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { androidOrigin, credentialOrigins } from '../src/lib/androidIdentity.js';
import { fixture } from './helper.js';

test('native passkey association matches the fixed release certificate and public package identity', async () => {
  const f = await fixture();
  try {
    const response = await f.app.inject('/.well-known/assetlinks.json');
    expect(response.statusCode).toBe(200);
    const links = response.json();
    const pinned = readFileSync('android/release-certificate.sha256', 'utf8').trim();
    expect(links).toHaveLength(1);
    expect(links[0].relation).toEqual(['delegate_permission/common.get_login_creds']);
    expect(links[0].target.package_name).toBe('io.github.zuquanzhi.veladeck.preview');
    expect(links[0].target.sha256_cert_fingerprints[0].replaceAll(':', '').toLowerCase()).toBe(
      pinned,
    );
    expect(androidOrigin).toBe(
      'android:apk-key-hash:' + Buffer.from(pinned, 'hex').toString('base64url'),
    );
    expect(credentialOrigins('https://workspace.example')).toEqual([
      'https://workspace.example',
      androidOrigin,
    ]);
    expect(credentialOrigins('https://workspace.example')).not.toContain(
      'android:apk-key-hash:untrusted',
    );
  } finally {
    await f.cleanup();
  }
});
