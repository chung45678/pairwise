import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import "./index.css";
import { PageShell } from "./components/ui";
import { Admin } from "./pages/admin/Admin";
import { Join } from "./pages/Join";
import { Landing } from "./pages/Landing";
import { MyMatches } from "./pages/MyMatches";

function NotFound() {
  return (
    <PageShell>
      <h1 className="text-[36px]">This page doesn't exist</h1>
      <p className="mt-2 text-muted">Check the link, or ask the organizer to send it again.</p>
      <Link to="/" className="mt-6 inline-block font-semibold text-tag hover:underline">Go to the home page</Link>
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
