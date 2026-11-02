import { useCallback, useState } from 'react';

const KEY = 'jasrain.sidebarCollapsed';

// remembers whether the admin/staff sidebar is icon-only (collapsed) or icon + text
export function useSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return [collapsed, toggle];
}
