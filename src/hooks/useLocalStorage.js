import { useEffect, useState } from 'react';
import { store } from '../lib/storage.js';

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    const saved = store.get(key, null);
    return saved && typeof initial === 'object' && !Array.isArray(initial) ? { ...initial, ...saved } : saved ?? initial;
  });
  useEffect(() => store.set(key, value), [key, value]);
  return [value, setValue];
}
