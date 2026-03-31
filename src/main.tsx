import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import LandingPage from "./components/LandingPage";
import PublicDisposableCheckInPage from "./components/PublicDisposableCheckInPage";
import "./styles.css";

type NavPage =
  | "home"
  | "about"
  | "contact"
  | "faqs"
  | "plans"
  | "login"
  | "signup"
  | "verify-email"
  | "admin-reset-password"
  | "staff-reset-password";

type LandingRouteProps = {
  page: NavPage;
};

const LandingRoute = ({ page }: LandingRouteProps) => {
  return <LandingPage page={page} />;
};

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingRoute page="home" />} />
        <Route path="/about" element={<LandingRoute page="about" />} />
        <Route path="/contact" element={<LandingRoute page="contact" />} />
        <Route path="/faqs" element={<LandingRoute page="faqs" />} />
        <Route path="/plans" element={<LandingRoute page="plans" />} />
        <Route path="/login" element={<LandingRoute page="login" />} />
        <Route path="/signup" element={<LandingRoute page="signup" />} />
        <Route path="/verify-email" element={<LandingRoute page="verify-email" />} />
        <Route
          path="/admin-reset-password"
          element={<LandingRoute page="admin-reset-password" />}
        />
        <Route
          path="/staff-reset-password"
          element={<LandingRoute page="staff-reset-password" />}
        />
        <Route path="/app" element={<App />} />
        <Route path="/app/organizations" element={<App />} />
        <Route path="/app/analytics" element={<App />} />
        <Route path="/app/disposable" element={<App />} />
        <Route path="/app/holidays" element={<App />} />
        <Route path="/app/settings" element={<App />} />
        <Route path="/public/disposable/:publicId" element={<PublicDisposableCheckInPage />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
