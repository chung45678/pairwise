import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import "./index.css";
import { PageShell } from "./components/ui";
import { stagger } from "./lib/motion";
import { Admin } from "./pages/admin/Admin";
import { Join } from "./pages/Join";
import { Landing } from "./pages/Landing";
import { MyMatches } from "./pages/MyMatches";

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
        <Route path="/e/:slug/admin" element={<Admin />} />
        <Route path="/e/:slug/join" element={<Join />} />
        <Route path="/m/:token" element={<MyMatches />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
