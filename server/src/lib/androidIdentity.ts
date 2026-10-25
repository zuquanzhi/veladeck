// Public identity of the fixed-signature Android Release app. Never a private signing key.
export const androidPackage = 'io.github.zuquanzhi.veladeck.preview';
export const androidCertificate =
  '7a149537b057d66450254fc84b85a099707fb574892b8427452c8a4dd06a715d';
export const androidOrigin =
  'android:apk-key-hash:' + Buffer.from(androidCertificate, 'hex').toString('base64url');
export function credentialOrigins(webOrigin: string) {
  return [webOrigin, androidOrigin];
}
export const androidAssetLinks = [
  {
    relation: ['delegate_permission/common.get_login_creds'],
    target: {
      namespace: 'android_app',
      package_name: androidPackage,
      sha256_cert_fingerprints: [androidCertificate.match(/.{2}/g)!.join(':').toUpperCase()],
    },
  },
];
