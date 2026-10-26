import { useState, useEffect, useCallback } from "react";

export type NavigationLayoutMode = "sidebar" | "topbar";

const NAV_LAYOUT_KEY = "user_navigation_layout";
const NAV_LAYOUT_EVENT = "navigation-layout-changed";

export function useNavigationLayout() {
  const [layout, setLayoutState] = useState<NavigationLayoutMode>(() => {
    try {
      const saved = localStorage.getItem(NAV_LAYOUT_KEY);
      if (saved === "topbar" || saved === "sidebar") {
        return saved;
      }
    } catch {
      // ignore localStorage errors
    }
    return "sidebar";
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === NAV_LAYOUT_KEY && (e.newValue === "sidebar" || e.newValue === "topbar")) {
        setLayoutState(e.newValue);
      }
    };

    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent<NavigationLayoutMode>;
      if (customEvent.detail === "sidebar" || customEvent.detail === "topbar") {
        setLayoutState(customEvent.detail);
      } else {
        const saved = localStorage.getItem(NAV_LAYOUT_KEY);
        if (saved === "topbar" || saved === "sidebar") {
          setLayoutState(saved);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(NAV_LAYOUT_EVENT, handleCustom);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(NAV_LAYOUT_EVENT, handleCustom);
    };
  }, []);

  const setLayout = useCallback((newLayout: NavigationLayoutMode) => {
    try {
      localStorage.setItem(NAV_LAYOUT_KEY, newLayout);
    } catch {
      // ignore localStorage errors
    }
    setLayoutState(newLayout);
    window.dispatchEvent(
      new CustomEvent<NavigationLayoutMode>(NAV_LAYOUT_EVENT, { detail: newLayout })
    );
  }, []);

  const toggleLayout = useCallback(() => {
    const next = layout === "sidebar" ? "topbar" : "sidebar";
    setLayout(next);
    return next;
  }, [layout, setLayout]);

  return {
    layout,
    isTopbar: layout === "topbar",
    isSidebar: layout === "sidebar",
    setLayout,
    toggleLayout,
  };
}
