"use client";
import { useEffect, useState } from "react";

const ThemeToggle = () => {
  const [theme, setTheme] = useState<string | null>(null);

  // read initial theme from document (set by inline script in layout)
  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    setTheme(t);
  }, []);

  const setDocumentTheme = (t: string | null) => {
    if (t) {
      document.documentElement.setAttribute("data-theme", t);
      localStorage.setItem("theme", t);
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("theme");
    }
    setTheme(t);
  };

  const toggle = () => {
    if (theme === "dark") setDocumentTheme("light");
    else if (theme === "light") setDocumentTheme(null); // back to system
    else setDocumentTheme("dark");
  };

  return (
    <button
      aria-label="Toggle color theme"
      title="Toggle theme (Dark / Light / System)"
      onClick={toggle}
      className="p-2 rounded-md border border-transparent hover-surface"
      style={{ background: 'transparent' }}
    >
      {theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "🖥️"}
    </button>
  );
};

export default ThemeToggle;
