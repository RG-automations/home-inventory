/// <reference path="../pb_data/types.d.ts" />
// Server-side free-tier limits. The app also checks them (lib/subscription.ts: FREE_LIMITS,
// isPremium) to hide the "add" buttons; this hook is the part nobody can bypass with the API.
// Keep the numbers and the premium rule in sync with lib/subscription.ts.
// Not atomic: two requests sent at the same instant can overshoot a limit by a record or two.

onRecordCreateRequest((e) => {
  const FREE_ITEMS = 50;
  const FREE_PHOTOS = 10;

  const user = e.auth;
  if (!user || user.collection().name !== 'users') return e.next(); // anonymous (rules deny) or superuser

  const tier = user.getString('tier');
  const expires = user.getDateTime('subscription_expires_at');
  const premium =
    tier === 'lifetime' ||
    (tier === 'premium' && (expires.isZero() || expires.unix() > Math.floor(Date.now() / 1000)));
  if (premium) return e.next();

  if (e.collection.name === 'items') {
    if ($app.countRecords('items', $dbx.hashExp({ user_id: user.id })) >= FREE_ITEMS) {
      throw new BadRequestError('FREE_LIMIT_ITEMS');
    }
  } else {
    // A photo is uploaded before the item/place that uses it is saved, so count linked photos
    // the same way the app does (items + places with a non-empty photo_url).
    const linked = (collection) =>
      $app.countRecords(collection, $dbx.exp("user_id = {:id} AND photo_url != ''", { id: user.id }));
    if (linked('items') + linked('locations') >= FREE_PHOTOS) {
      throw new BadRequestError('FREE_LIMIT_PHOTOS');
    }
  }

  return e.next();
}, 'items', 'photos');
