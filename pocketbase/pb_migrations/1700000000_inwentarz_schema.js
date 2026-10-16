/// <reference path="../pb_data/types.d.ts" />
// Schemat Inwentarza Domowego (odpowiednik supabase/*.sql + polityk RLS).
// Zastosuje sie sam przy starcie PocketBase. Pisany pod PocketBase 0.23+ (JS migrations).

migrate((app) => {
  const users = app.findCollectionByNameOrId('users');

  // --- users: status subskrypcji (zastepuje tabele profiles) ---
  users.fields.add(new SelectField({
    name: 'tier',
    values: ['free', 'premium', 'lifetime'],
    maxSelect: 1,
  }));
  users.fields.add(new DateField({ name: 'subscription_expires_at' }));

  // Uzytkownik czyta/zmienia tylko siebie, ale NIE moze ustawic sobie tier ani daty
  // wygasniecia (wczesniej: brak polityki UPDATE na profiles). Zmienia je tylko superuser.
  users.listRule = 'id = @request.auth.id';
  users.viewRule = 'id = @request.auth.id';
  users.updateRule =
    'id = @request.auth.id && @request.body.tier:isset = false && @request.body.subscription_expires_at:isset = false';
  users.deleteRule = 'id = @request.auth.id';
  // Token do chronionych plikow wazny 1 h (aplikacja cache'uje linki do zdjec na ~50 min).
  users.fileToken.duration = 3600;
  app.save(users);

  const own = '@request.auth.id != "" && user_id = @request.auth.id';
  const ownCreate = '@request.auth.id != "" && @request.body.user_id = @request.auth.id';

  // --- photos: zdjecia miejsc i przedmiotow (zamiast bucketu item-photos) ---
  const photos = new Collection({
    type: 'base',
    name: 'photos',
    listRule: own,
    viewRule: own,
    createRule: ownCreate,
    updateRule: own,
    deleteRule: own,
    fields: [
      { type: 'relation', name: 'user_id', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      // protected: plik widoczny tylko z tokenem zalogowanego wlasciciela
      { type: 'file', name: 'file', required: true, maxSelect: 1, maxSize: 15 * 1024 * 1024, protected: true,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'] },
    ],
  });
  app.save(photos);

  // --- locations: drzewo miejsc (parent_id wskazuje na sama siebie) ---
  const locations = new Collection({
    type: 'base',
    name: 'locations',
    listRule: own,
    viewRule: own,
    createRule: ownCreate,
    updateRule: own,
    deleteRule: own,
    fields: [
      { type: 'relation', name: 'user_id', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'name', required: true, max: 500 },
      { type: 'text', name: 'photo_url', max: 200 }, // "{id zdjecia}/{plik}"
      { type: 'date', name: 'created_at' },
    ],
    indexes: ['CREATE INDEX idx_locations_user ON locations (user_id)'],
  });
  app.save(locations);

  // Relacja do samej siebie wymaga istniejacej kolekcji, wiec dodajemy ja po pierwszym zapisie.
  const savedLocations = app.findCollectionByNameOrId('locations');
  savedLocations.fields.add(new RelationField({
    name: 'parent_id',
    collectionId: savedLocations.id,
    maxSelect: 1,
    cascadeDelete: true, // usuniecie miejsca usuwa podmiejsca
  }));
  savedLocations.addIndex('idx_locations_parent', false, 'parent_id', '');
  app.save(savedLocations);

  // --- items ---
  const items = new Collection({
    type: 'base',
    name: 'items',
    listRule: own,
    viewRule: own,
    createRule: ownCreate,
    updateRule: own,
    deleteRule: own,
    fields: [
      { type: 'relation', name: 'user_id', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'relation', name: 'location_id', required: true, collectionId: savedLocations.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'name', required: true, max: 500 },
      { type: 'text', name: 'description', max: 5000 },
      { type: 'text', name: 'photo_url', max: 200 },
      { type: 'date', name: 'created_at' },
    ],
    indexes: [
      'CREATE INDEX idx_items_user ON items (user_id)',
      'CREATE INDEX idx_items_location ON items (location_id)',
      'CREATE INDEX idx_items_name ON items (name COLLATE NOCASE)',
    ],
  });
  app.save(items);
}, (app) => {
  for (const name of ['items', 'locations', 'photos']) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
});
