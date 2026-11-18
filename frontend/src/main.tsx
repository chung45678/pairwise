import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { api } from "./api";
import "./index.css";
import { Loading, PageShell } from "./components/ui";
import { stagger } from "./lib/motion";
import { Admin } from "./pages/admin/Admin";
import { Join } from "./pages/Join";
import { Landing } from "./pages/Landing";
import { MyMatches } from "./pages/MyMatches";

/** Stable links for the README: /demo and /demo/guest resolve to the live demo. */
function DemoRedirect({ to }: { to: "admin" | "guest" }) {
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    api
      .demo()
      .then((d) => {
        const target = d.enabled ? d[to] : null;
        if (target) window.location.replace(target);
        else setMissing(true);
      })
      .catch(() => setMissing(true));
  }, [to]);
  return missing ? <NotFound /> : <PageShell><Loading label="Opening the demo" lines={1} /></PageShell>;
}

function NotFound() {
  return (
    <PageShell>
      <h1 className="enter text-[32px] sm:text-[40px]" style={stagger(0)}>This page doesn't exist</h1>
      <p className="enter mt-3 text-muted" style={stagger(1)}>Check the link, or ask the organizer to send it again.</p>
      <Link
        to="/"
        className="enter mt-8 inline-block font-medium text-link underline decoration-link/30 underline-offset-4 transition-colors duration-[var(--dur-instant)] hover:decoration-link"
        style={stagger(2)}
      >
        Go to the home page
      </Link>
    </PageShell>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/demo" element={<DemoRedirect to="admin" />} />
        <Route path="/demo/guest" element={<DemoRedirect to="guest" />} />
        <Route path="/e/:slug/admin" element={<Admin />} />
        <Route path="/e/:slug/join" element={<Join />} />
        <Route path="/m/:token" element={<MyMatches />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
