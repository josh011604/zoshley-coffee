export type CachedCategory = {
  id: string;
  name: string;
  parent?: string;
};

export const categoryStorageKey = 'zoshley-categories';
export const categorySyncEventName = 'zoshley-categories-updated';

export const readCategoryCache = (): CachedCategory[] | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(categoryStorageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return null;

    return parsed
      .filter((item) => item && item.id && item.name)
      .map((item) => ({
        id: String(item.id),
        name: String(item.name),
        parent: item.parent ? String(item.parent) : undefined,
      }));
  } catch {
    return null;
  }
};

export const writeCategoryCache = (categories: CachedCategory[]) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(categoryStorageKey, JSON.stringify(categories));
  } catch {
    // Ignore storage failures and keep the UI responsive.
  }
};

export const emitCategorySync = () => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new Event(categorySyncEventName));
};