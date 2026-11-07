function ensureFavoriteAlbum(list) {
  const albums = Array.isArray(list) ? [...list] : [];
  let index = albums.findIndex((entry) => entry.id === "favorites");
  if (index < 0) {
    albums.splice(1, 0, { id: "favorites", name: "Favorites", system: true, ids: [] });
    index = 1;
  }
  const favorite = albums[index];
  const nextFavorite = {
    ...favorite,
    ids: Array.isArray(favorite.ids) ? [...favorite.ids] : []
  };
  albums[index] = nextFavorite;
  return { albums, favorite: nextFavorite, favoriteIndex: index };
}

export function isFavoriteInAlbums(list, id) {
  const { favorite } = ensureFavoriteAlbum(list);
  return favorite.ids.includes(id);
}

export function toggleFavoriteInAlbums(list, id) {
  const { albums, favorite, favoriteIndex } = ensureFavoriteAlbum(list);
  const ids = favorite.ids.includes(id)
    ? favorite.ids.filter((entry) => entry !== id)
    : [...favorite.ids, id];
  albums[favoriteIndex] = { ...favorite, ids };
  return albums;
}

export function albumContainsItem(album, item) {
  if (!album || album.id === "all") return true;
  if (album.smart === "user") return item?.origin === "user" || String(item?.source || "").includes("user_anims/");
  return (album.ids || []).includes(item?.id);
}

export function addAnimationToAlbumList(list, albumId, animId, availableIds = new Set()) {
  const albums = Array.isArray(list) ? [...list] : [];
  const index = albums.findIndex((entry) => entry.id === albumId);
  if (index < 0) return { albums, changed: false };
  const album = albums[index];
  if (!album || album.id === "all" || album.smart) return { albums, changed: false };
  if (!availableIds.has(animId)) return { albums, changed: false };
  const ids = [...new Set([...(album.ids || []), animId])];
  const changed = ids.length !== (album.ids || []).length;
  albums[index] = { ...album, ids };
  return { albums, changed };
}

export function removeAnimationFromAlbumList(list, albumId, animId) {
  const albums = Array.isArray(list) ? [...list] : [];
  const index = albums.findIndex((entry) => entry.id === albumId);
  if (index < 0) return { albums, changed: false };
  const album = albums[index];
  if (!album || album.system || album.smart) return { albums, changed: false };
  const ids = (album.ids || []).filter((id) => id !== animId);
  const changed = ids.length !== (album.ids || []).length;
  albums[index] = { ...album, ids };
  return { albums, changed };
}

export function swapAlbumsById(list, fromId, toId) {
  const albums = Array.isArray(list) ? [...list] : [];
  if (!fromId || !toId || fromId === toId) return { albums, changed: false };
  const fromIndex = albums.findIndex((album) => album.id === fromId);
  const toIndex = albums.findIndex((album) => album.id === toId);
  if (fromIndex < 0 || toIndex < 0) return { albums, changed: false };
  [albums[fromIndex], albums[toIndex]] = [albums[toIndex], albums[fromIndex]];
  return { albums, changed: true };
}

export function createAlbumInList(list, nowMs = Date.now()) {
  const albums = Array.isArray(list) ? [...list] : [];
  const nextNumber = albums.filter((album) => !album.system).length + 1;
  const id = `album_${nowMs}`;
  albums.push({ id, name: `Album ${nextNumber}`, system: false, ids: [] });
  return { albums, id };
}

export function renameAlbumInList(list, id, name) {
  const albums = Array.isArray(list) ? [...list] : [];
  const index = albums.findIndex((entry) => entry.id === id);
  if (index < 0) return { albums, changed: false };
  const album = albums[index];
  if (!album || album.system) return { albums, changed: false };
  const nextName = String(name || "").trim().slice(0, 48);
  if (!nextName || nextName === album.name) return { albums, changed: false };
  albums[index] = { ...album, name: nextName };
  return { albums, changed: true };
}

export function deleteAlbumFromList(list, id) {
  const albums = Array.isArray(list) ? [...list] : [];
  const album = albums.find((entry) => entry.id === id);
  if (!album || album.system) return { albums, changed: false };
  return { albums: albums.filter((entry) => entry.id !== id), changed: true };
}
