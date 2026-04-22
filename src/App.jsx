import React, { useEffect, useState } from "react";
import PublicPage from "./PublicPage";
import AdminPage from "./AdminPage";

export default function App() {
  const [hash, setHash] = useState(window.location.hash || "#/");

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (hash === "#/admin") {
    return <AdminPage />;
  }

  return <PublicPage />;
}