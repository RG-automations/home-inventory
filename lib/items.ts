import { getCurrentUserOrThrow, pb } from './pocketbase';
import { toItem } from './locations';
import { removePhotos } from './photos';
import { invalidateSignedUrl } from './signed-url-cache';

export async function createItem(params: {
  name: string;
  description: string | null;
  photoUrl: string | null;
  locationId: string;
}) {
  const user = getCurrentUserOrThrow();

  const record = await pb.collection('items').create({
    name: params.name,
    description: params.description ?? '',
    photo_url: params.photoUrl ?? '',
    location_id: params.locationId,
    user_id: user.id,
    created_at: new Date().toISOString(),
  });

  return toItem(record);
}

export async function deleteItem(id: string, photoPath: string | null) {
  await pb.collection('items').delete(id);

  if (photoPath) {
    invalidateSignedUrl(photoPath);
    await removePhotos([photoPath]);
  }
}

export async function updateItem(params: {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  locationId: string;
  oldPhotoPathToDelete: string | null;
}) {
  await pb.collection('items').update(params.id, {
    name: params.name,
    description: params.description ?? '',
    photo_url: params.photoUrl ?? '',
    location_id: params.locationId,
  });

  if (params.oldPhotoPathToDelete) {
    invalidateSignedUrl(params.oldPhotoPathToDelete);
    await removePhotos([params.oldPhotoPathToDelete]);
  }
}
