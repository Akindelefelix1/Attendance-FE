import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import LandingPage from "./components/LandingPage";
import "./styles.css";

type NavPage = "home" | "about" | "contact" | "faqs" | "plans" | "login" | "signup";

type LandingRouteProps = {
  page: NavPage;
};

const LandingRoute = ({ page }: LandingRouteProps) => {
  const handleEnter = () => {
    window.location.assign("/login");
  };

  return <LandingPage page={page} onEnter={handleEnter} />;
};

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingRoute page="home" />} />
        <Route path="/about" element={<LandingRoute page="about" />} />
        <Route path="/contact" element={<LandingRoute page="contact" />} />
        <Route path="/faqs" element={<LandingRoute page="faqs" />} />
        <Route path="/plans" element={<LandingRoute page="plans" />} />
        <Route path="/login" element={<LandingRoute page="login" />} />
        <Route path="/signup" element={<LandingRoute page="signup" />} />
        <Route path="/app" element={<App />} />
        <Route path="/app/organizations" element={<App />} />
        <Route path="/app/analytics" element={<App />} />
        <Route path="/app/settings" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
