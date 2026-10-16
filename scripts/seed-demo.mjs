// Creates a demo account with fictional places and items (no real data).
// Run against a LOCAL PocketBase:  PB_URL=http://localhost:8090 node scripts/seed-demo.mjs
import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.PB_URL ?? 'http://localhost:8090');
const email = 'demo@example.com';
const password = 'demo-password-123';

await pb.collection('users').create({ email, password, passwordConfirm: password }).catch(() => {});
await pb.collection('users').authWithPassword(email, password);
const user_id = pb.authStore.record.id;
const now = new Date().toISOString();

const place = (name, parent) =>
  pb.collection('locations').create({ user_id, name, created_at: now, ...(parent && { parent_id: parent.id }) });

const house = await place('Dom');
const kitchen = await place('Kuchnia', house);
const drawer = await place('Szuflada nr 2', kitchen);
const pantry = await place('Spiżarnia', kitchen);
const garage = await place('Garaż');
const shelf = await place('Regał z narzędziami', garage);

const items = [
  [drawer, 'Otwieracz do wina', 'Srebrny, w pudełku'],
  [drawer, 'Zapasowe baterie AA', '8 sztuk'],
  [pantry, 'Słoiki na przetwory', '12 sztuk, 0,5 l'],
  [shelf, 'Wiertarka udarowa', 'Walizka na górnej półce'],
  [shelf, 'Zestaw kluczy imbusowych', 'Czerwone etui'],
  [garage, 'Opony zimowe', '4 szt., 205/55 R16'],
];
for (const [loc, name, description] of items) {
  await pb.collection('items').create({ user_id, location_id: loc.id, name, description, created_at: now });
}
console.log(`Done. Log in as ${email} / ${password}`);
