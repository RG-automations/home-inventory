// Black-box checks of the PocketBase access rules and free-tier limits. Needs a running instance with the
// migrations from pocketbase/pb_migrations applied (throwaway data only: it creates accounts).
//   PB_URL=http://127.0.0.1:8090 npm run test:rules
// Optional: PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD enable the 'premium is not limited' check.
const PB = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const PASSWORD = 'Test-password-12345';
// 1x1 transparent PNG
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

async function call(method, path, { token, json, form } = {}) {
  // The built-in rate limiter answers 429 for a moment after a burst; wait and retry.
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(`${PB}/api/${path}`, {
      method,
      headers: { ...(token && { Authorization: token }), ...(json && { 'Content-Type': 'application/json' }) },
      body: json ? JSON.stringify(json) : form,
    });
    if (res.status === 429 && attempt < 12) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      continue;
    }
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }
}

async function signUp(extra = {}) {
  const email = `t${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`;
  const created = await call('POST', 'collections/users/records', {
    json: { email, password: PASSWORD, passwordConfirm: PASSWORD, ...extra },
  });
  if (created.status !== 200) return { created };
  const auth = await call('POST', 'collections/users/auth-with-password', { json: { identity: email, password: PASSWORD } });
  return { created, token: auth.body.token, id: auth.body.record?.id };
}

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (${detail})`}`);
  if (!ok) failed += 1;
}

const privileged = await signUp({ tier: 'lifetime' });
check('signup with tier=lifetime is rejected', privileged.created.status >= 400 && privileged.created.status < 500, `status ${privileged.created.status}`);

const a = await signUp();
const b = await signUp();
check('normal signup works', Boolean(a.token && b.token), `status ${a.created.status}`);

const photoForm = (userId) => {
  const form = new FormData();
  form.append('user_id', userId);
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'x.png');
  return form;
};
const photo = await call('POST', 'collections/photos/records', { token: a.token, form: photoForm(a.id) });
check('photo upload with user_id works', photo.status === 200, `status ${photo.status} ${JSON.stringify(photo.body)}`);

const place = await call('POST', 'collections/locations/records', { token: a.token, json: { user_id: a.id, name: 'Kitchen' } });
const item = await call('POST', 'collections/items/records', { token: a.token, json: { user_id: a.id, location_id: place.body.id, name: 'Drill' } });
check('owner can create a location and an item', place.status === 200 && item.status === 200, `${place.status}/${item.status}`);

const handOver = await call('PATCH', `collections/items/records/${item.body.id}`, { token: a.token, json: { user_id: b.id } });
check('changing user_id on update is rejected', handOver.status >= 400 && handOver.status < 500, `status ${handOver.status}`);

const rename = await call('PATCH', `collections/items/records/${item.body.id}`, { token: a.token, json: { name: 'Drill 2' } });
check('owner can still update own item', rename.status === 200, `status ${rename.status}`);

const stolen = await call('GET', `collections/items/records/${item.body.id}`, { token: b.token });
check("other user cannot read someone's item", stolen.status === 404 || stolen.status === 403, `status ${stolen.status}`);

const selfTier = await call('PATCH', `collections/users/records/${a.id}`, { token: a.token, json: { tier: 'lifetime' } });
check('user cannot upgrade own tier', selfTier.status >= 400 && selfTier.status < 500, `status ${selfTier.status}`);

// --- free-tier limits (pocketbase/pb_hooks/free_limits.pb.js) ---
const FREE_ITEMS = 50;
const FREE_PHOTOS = 10;
const c = await signUp();
const cPlace = await call('POST', 'collections/locations/records', { token: c.token, json: { user_id: c.id, name: 'Limits' } });
const newItem = (n, photo = '') =>
  call('POST', 'collections/items/records', { token: c.token, json: { user_id: c.id, location_id: cPlace.body.id, name: 'i' + n, photo_url: photo } });

let accepted = 0;
for (let i = 0; i < FREE_PHOTOS; i += 1) accepted += (await newItem(i, 'p' + i + '/f.png')).status === 200 ? 1 : 0;
check('free user can create items with photos up to the photo limit', accepted === FREE_PHOTOS, 'accepted ' + accepted);

const overPhoto = await call('POST', 'collections/photos/records', { token: c.token, form: photoForm(c.id) });
check('free user cannot upload a photo over the limit', overPhoto.status === 400 && JSON.stringify(overPhoto.body).includes('FREE_LIMIT_PHOTOS'), 'status ' + overPhoto.status + ' ' + JSON.stringify(overPhoto.body));

for (let i = FREE_PHOTOS; i < FREE_ITEMS; i += 1) accepted += (await newItem(i)).status === 200 ? 1 : 0;
check('free user can create up to the item limit', accepted === FREE_ITEMS, 'accepted ' + accepted);

const overItem = await newItem(FREE_ITEMS);
check('free user cannot create an item over the limit', overItem.status === 400 && JSON.stringify(overItem.body).includes('FREE_LIMIT_ITEMS'), 'status ' + overItem.status + ' ' + JSON.stringify(overItem.body));

if (process.env.PB_SUPERUSER_EMAIL && process.env.PB_SUPERUSER_PASSWORD) {
  const su = await call('POST', 'collections/_superusers/auth-with-password', { json: { identity: process.env.PB_SUPERUSER_EMAIL, password: process.env.PB_SUPERUSER_PASSWORD } });
  await call('PATCH', 'collections/users/records/' + c.id, { token: su.body.token, json: { tier: 'lifetime' } });
  const premiumItem = await newItem(FREE_ITEMS + 1);
  check('lifetime user is not limited', premiumItem.status === 200, 'status ' + premiumItem.status);
} else {
  console.log("SKIP  lifetime user is not limited (set PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD)");
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
