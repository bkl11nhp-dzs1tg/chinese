// Tạo cặp khóa VAPID cho thông báo đẩy. Khóa bí mật lưu ở worker/.vapid-private.json (không đưa lên git).
// Chạy: node scripts/vapid-keys.js  → in khóa công khai (ghi vào wrangler.toml) và lệnh đẩy khóa bí mật lên Cloudflare.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
const file = 'worker/.vapid-private.json';
let jwk;
if (existsSync(file)) jwk = JSON.parse(readFileSync(file, 'utf8'));
else {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  writeFileSync(file, JSON.stringify(jwk));
}
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
console.log(pub);
