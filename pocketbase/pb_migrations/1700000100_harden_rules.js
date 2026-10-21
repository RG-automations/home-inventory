/// <reference path="../pb_data/types.d.ts" />
// Hardens access rules found in the audit:
//  - signup could set `tier` / `subscription_expires_at` (free premium),
//  - a user could hand their own record to another user by changing `user_id`.
// A new migration (not an edit of 1700000000) because the first one already ran on live servers.

const OWN = '@request.auth.id != "" && user_id = @request.auth.id';
const OWN_NO_REASSIGN = OWN + ' && @request.body.user_id:isset = false';
const SIGNUP_NO_TIER =
  '@request.body.tier:isset = false && @request.body.subscription_expires_at:isset = false';

migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  users.createRule = SIGNUP_NO_TIER;
  app.save(users);

  for (const name of ['items', 'locations', 'photos']) {
    const collection = app.findCollectionByNameOrId(name);
    collection.updateRule = OWN_NO_REASSIGN;
    app.save(collection);
  }

  // Open signup: switch on PocketBase's built-in rate limiter (default rules).
  const settings = app.settings();
  settings.rateLimits.enabled = true;
  app.save(settings);
}, (app) => {
  const users = app.findCollectionByNameOrId('users');
  users.createRule = '';
  app.save(users);

  for (const name of ['items', 'locations', 'photos']) {
    const collection = app.findCollectionByNameOrId(name);
    collection.updateRule = OWN;
    app.save(collection);
  }
});
