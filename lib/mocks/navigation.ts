
import { useState, useEffect } from "react";

// Event bus to trigger re-renders on route changes
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

// Listen to popstate to handle back/forward
if (typeof window !== "undefined") {
  window.addEventListener("popstate", notify);
  // Monkey patch pushState and replaceState to detect programmatic navigation
  const originalPushState = window.history.pushState;
  window.history.pushState = function(...args) {
    const result = originalPushState.apply(this, args);
    notify();
    return result;
  };
  
  const originalReplaceState = window.history.replaceState;
  window.history.replaceState = function(...args) {
    const result = originalReplaceState.apply(this, args);
    notify();
    return result;
  };
}

export const useRouter = () => {
  type NavigateOptions = { scroll?: boolean };

  return {
    push: (href: string, _options?: NavigateOptions) => {
      void _options;
      // Handle query params if passed in object (not supported in this simple mock, assuming string)
      window.history.pushState({}, "", href);
    },
    replace: (href: string, _options?: NavigateOptions) => {
      void _options;
      window.history.replaceState({}, "", href);
    },
    back: () => {
      window.history.back();
    },
    forward: () => {
      window.history.forward();
    },
    refresh: () => {
      notify();
    }
  };
};

export const useSearchParams = () => {
  const [params, setParams] = useState<URLSearchParams>(
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams()
  );

  useEffect(() => {
    const handleChange = () => {
      setParams(new URLSearchParams(window.location.search));
    };
    listeners.add(handleChange);
    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  return params;
};

export const usePathname = () => {
  const [pathname, setPathname] = useState(
    typeof window !== "undefined" ? window.location.pathname : "/"
  );

  useEffect(() => {
    const handleChange = () => {
      setPathname(window.location.pathname);
    };
    listeners.add(handleChange);
    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  return pathname;
};
