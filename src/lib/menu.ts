import type { MenuItem } from '../types';

export const menuStorageKey = 'zoshley-menu-items';
export const menuSyncEventName = 'zoshley-menu-items-updated';

export const readMenuCache = (): MenuItem[] | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(menuStorageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return null;

    return parsed
      .filter((item) => item && item.id)
      .map((item) => ({
        id: String(item.id),
        name: String(item.name ?? 'Untitled Item'),
        description: String(item.description ?? 'Freshly prepared in the cafe.'),
        category: String(item.category ?? 'Espresso'),
        price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
        featured: Boolean(item.featured),
        is_available: item.is_available ?? true,
        icon: item.icon,
        prep_time: item.prep_time,
      }));
  } catch {
    return null;
  }
};

export const writeMenuCache = (items: MenuItem[]) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(menuStorageKey, JSON.stringify(items));
  } catch {
    // Ignore storage failures and keep the UI responsive.
  }
};

export const emitMenuSync = () => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new Event(menuSyncEventName));
};