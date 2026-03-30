import { useMemo, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ApiError,
  createOrganization,
  loginAdmin,
  loginStaff,
  requestAdminReset,
  registerAdmin,
  requestAdminVerify,
  requestStaffReset,
  resetAdminPassword,
  resetStaffPassword,
  verifyAdmin
} from "../lib/api";

type Props = {
  page:
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
};

type FaqEntry = {
  id: string;
  question: string;
  answer: string;
};

const faqEntries: FaqEntry[] = [
  {
    id: "multi-org",
    question: "Can we manage attendance for multiple branches or organizations?",
    answer:
      "Yes. You can manage multiple organizations with separate staff lists, rules, and analytics from one platform."
  },
  {
    id: "history",
    question: "Will attendance records remain available over time?",
    answer:
      "Yes. Attendance history is saved, searchable, and exportable for reporting and audits whenever needed."
  },
  {
    id: "rules",
    question: "Can we customize late, early checkout, and policy rules?",
    answer:
      "Absolutely. Admins can configure check-in windows, late thresholds, early checkout rules, and attendance policies per organization."
  },
  {
    id: "support",
    question: "Do you provide onboarding and setup support?",
    answer:
      "Yes. Our team helps with onboarding, setup guidance, and best-practice rollout so your team can go live quickly."
  }
];

const LandingPage = ({ page }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [signupOrgName, setSignupOrgName] = useState("");
  const [signupLocation, setSignupLocation] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<"admin" | "staff">("admin");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authBusy, setAuthBusy] = useState<"login" | "signup" | null>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotNotice, setForgotNotice] = useState("");
  const [showForgotPanel, setShowForgotPanel] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetNotice, setResetNotice] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "verifying" | "success" | "error">(
    "idle"
  );
  const [verifyMessage, setVerifyMessage] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const heroImages = [
    "https://res.cloudinary.com/doxxevnyt/image/upload/v1773662233/8b9bce25-da3f-4c63-a9c4-6c543a15e1f1_yteu7o.png"
  ];
  const [heroIndex, setHeroIndex] = useState(0);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const handleSignup = async () => {
    if (authBusy) return;
    setAuthError("");
    setAuthNotice("");
    if (!signupOrgName || !signupLocation || !signupEmail || !signupPassword) {
      setAuthError("Please fill all fields.");
      return;
    }
    setAuthBusy("signup");
    try {
      const createdOrg = await createOrganization({
        name: signupOrgName.trim(),
        location: signupLocation.trim()
      });
      await registerAdmin({
        orgId: createdOrg.id,
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword
      });
      setAuthNotice(
        "Verification email sent. Please check your inbox and verify before logging in."
      );
      setSignupPassword("");
    } catch {
      setAuthError("Could not create account. Please try again.");
    } finally {
      setAuthBusy(null);
    }
  };

  const handleLogin = async () => {
    if (authBusy) return;
    setAuthError("");
    setAuthNotice("");
    if (!loginEmail || !loginPassword) {
      setAuthError("Enter your email and password.");
      return;
    }
    setAuthBusy("login");
    try {
      if (loginMode === "staff") {
        await loginStaff({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword
        });
      } else {
        await loginAdmin({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword
        });
      }
      navigate("/app");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";
      if (loginMode === "admin" && errorMessage.includes("Email not verified")) {
        await requestAdminVerify({ email: loginEmail.trim().toLowerCase() }).catch(
          () => undefined
        );
        setAuthError(
          "Admin email is not verified yet. A new verification link has been sent."
        );
      } else {
        setAuthError(errorMessage || "Incorrect email or password.");
      }
    } finally {
      setAuthBusy(null);
    }
  };

  const handleForgotPassword = async () => {
    if (forgotBusy) return;
    setForgotError("");
    setForgotNotice("");
    if (!forgotEmail.trim()) {
      setForgotError("Enter your email address.");
      return;
    }

    setForgotBusy(true);
    try {
      const normalizedEmail = forgotEmail.trim().toLowerCase();
      if (loginMode === "admin") {
        await requestAdminReset({ email: normalizedEmail });
      } else {
        await requestStaffReset({ email: normalizedEmail });
      }
      setForgotNotice("If this email exists, a reset link has been sent.");
    } catch (error) {
      setForgotError(error instanceof Error ? error.message : "Could not send reset link.");
    } finally {
      setForgotBusy(false);
    }
  };

  const authPageTitle = useMemo(() => {
    if (page === "login") return "Welcome back";
    if (page === "signup") return "Create organization";
    if (page === "verify-email") return "Verify email";
    if (page === "admin-reset-password") return "Reset admin password";
    if (page === "staff-reset-password") return "Reset staff password";
    return "";
  }, [page]);

  const isBusy = authBusy !== null;

  useEffect(() => {
    if (page !== "home" || heroImages.length <= 1) return;
    const interval = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [page, heroImages.length]);

  useEffect(() => {
    if (page !== "faqs") {
      setOpenFaqId(null);
    }
  }, [page]);

  useEffect(() => {
    if (page !== "verify-email") {
      return;
    }

    const token = new URLSearchParams(location.search).get("token")?.trim();
    if (!token) {
      setVerifyStatus("error");
      setVerifyMessage("Verification token is missing from this link.");
      return;
    }

    setVerifyStatus("verifying");
    setVerifyMessage("");

    verifyAdmin({ token })
      .then(() => {
        setVerifyStatus("success");
        setVerifyMessage("Email verified successfully. Your account is now active.");
      })
      .catch(() => {
        setVerifyStatus("error");
        setVerifyMessage("Verification link is invalid or expired.");
      });
  }, [location.search, page]);

  useEffect(() => {
    if (page !== "admin-reset-password" && page !== "staff-reset-password") {
      return;
    }
    setResetError("");
    setResetNotice("");
  }, [page]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [page]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="landing">
      <nav className={`top-nav ${mobileMenuOpen ? "menu-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">A</span>
          <span>Attendance</span>
        </div>
        <button
          className="mobile-menu-toggle"
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-controls="top-nav-menu"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
        <div className="top-nav-menu" id="top-nav-menu">
          <div className="nav-links">
            <Link
              className={page === "home" ? "nav-link active" : "nav-link"}
              to="/"
              onClick={closeMobileMenu}
            >
              Home
            </Link>
            <Link
              className={page === "about" ? "nav-link active" : "nav-link"}
              to="/about"
              onClick={closeMobileMenu}
            >
              About us
            </Link>
            <Link
              className={page === "contact" ? "nav-link active" : "nav-link"}
              to="/contact"
              onClick={closeMobileMenu}
            >
              Contact us
            </Link>
            <Link
              className={page === "faqs" ? "nav-link active" : "nav-link"}
              to="/faqs"
              onClick={closeMobileMenu}
            >
              FAQs
            </Link>
            <Link
              className={page === "plans" ? "nav-link active" : "nav-link"}
              to="/plans"
              onClick={closeMobileMenu}
            >
              Plans
            </Link>
          </div>
          <div className="nav-actions">
            <Link className="btn ghost" to="/login" onClick={closeMobileMenu}>
              Log in
            </Link>
            <Link className="btn solid" to="/signup" onClick={closeMobileMenu}>
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {page === "login" ||
      page === "signup" ||
      page === "verify-email" ||
      page === "admin-reset-password" ||
      page === "staff-reset-password" ? (
        <section className="auth-page">
          <div className="auth-card">
            <h1>{authPageTitle}</h1>
            <p className="muted">
              {page === "login"
                ? "Access your organization attendance dashboard."
                : page === "signup"
                  ? "Register your organization to get started."
                  : page === "verify-email"
                    ? "Confirm your admin email to activate your account."
                    : "Set a new password to regain account access."}
            </p>
            {authError ? <p className="auth-error">{authError}</p> : null}
            {authNotice ? <p className="auth-notice">{authNotice}</p> : null}
            {page === "login" ? (
              <div className="auth-form">
                <label>
                  Login as
                  <select
                    value={loginMode}
                    onChange={(event) =>
                      setLoginMode(event.target.value as "admin" | "staff")
                    }
                    disabled={isBusy}
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    disabled={isBusy}
                  />
                </label>
                <label>
                  Password
                  <div className="auth-password-field">
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      disabled={isBusy}
                    />
                    <button
                      className="auth-password-toggle"
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      disabled={isBusy}
                      aria-label={showLoginPassword ? "Hide password" : "Show password"}
                    >
                      {showLoginPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
                {loginMode === "staff" ? (
                  <p className="muted">
                    Use your organization staff email and your personal password.
                  </p>
                ) : null}
                <button
                  className="btn solid"
                  type="button"
                  onClick={handleLogin}
                  disabled={isBusy}
                >
                  {authBusy === "login" ? "Logging in..." : `Log in as ${loginMode}`}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    setShowForgotPanel((prev) => !prev);
                    setForgotError("");
                    setForgotNotice("");
                    if (!forgotEmail) {
                      setForgotEmail(loginEmail.trim().toLowerCase());
                    }
                  }}
                  disabled={isBusy}
                >
                  {showForgotPanel ? "Hide forgot password" : "Forgot password?"}
                </button>
                {showForgotPanel ? (
                  <div className="auth-form">
                    <label>
                      Reset email
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(event) => setForgotEmail(event.target.value)}
                        disabled={forgotBusy || isBusy}
                      />
                    </label>
                    {forgotError ? <p className="auth-error">{forgotError}</p> : null}
                    {forgotNotice ? <p className="auth-notice">{forgotNotice}</p> : null}
                    <button
                      className="btn solid"
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={forgotBusy || isBusy}
                    >
                      {forgotBusy ? "Sending link..." : `Send ${loginMode} reset link`}
                    </button>
                  </div>
                ) : null}
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => navigate("/signup")}
                  disabled={isBusy}
                >
                  Create new organization
                </button>
              </div>
            ) : page === "signup" ? (
              <div className="auth-form">
                <label>
                  Organization name
                  <input
                    type="text"
                    value={signupOrgName}
                    onChange={(event) => setSignupOrgName(event.target.value)}
                    disabled={isBusy}
                  />
                </label>
                <label>
                  Location
                  <input
                    type="text"
                    value={signupLocation}
                    onChange={(event) => setSignupLocation(event.target.value)}
                    disabled={isBusy}
                  />
                </label>
                <label>
                  Admin email
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(event) => setSignupEmail(event.target.value)}
                    disabled={isBusy}
                  />
                </label>
                <label>
                  Password
                  <div className="auth-password-field">
                    <input
                      type={showSignupPassword ? "text" : "password"}
                      value={signupPassword}
                      onChange={(event) => setSignupPassword(event.target.value)}
                      disabled={isBusy}
                    />
                    <button
                      className="auth-password-toggle"
                      type="button"
                      onClick={() => setShowSignupPassword((prev) => !prev)}
                      disabled={isBusy}
                      aria-label={showSignupPassword ? "Hide password" : "Show password"}
                    >
                      {showSignupPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
                <button
                  className="btn solid"
                  type="button"
                  onClick={handleSignup}
                  disabled={isBusy}
                >
                  {authBusy === "signup" ? "Creating account..." : "Create organization"}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => navigate("/login")}
                  disabled={isBusy}
                >
                  Already have an account
                </button>
              </div>
            ) : page === "verify-email" ? (
              <div className="auth-form">
                {verifyStatus === "verifying" ? (
                  <p className="muted">Verifying your email...</p>
                ) : null}
                {verifyStatus === "success" ? (
                  <p className="auth-notice">{verifyMessage}</p>
                ) : null}
                {verifyStatus === "error" ? (
                  <p className="auth-error">{verifyMessage}</p>
                ) : null}
                <button className="btn solid" type="button" onClick={() => navigate("/app")}>
                  Continue to app
                </button>
                <button className="btn ghost" type="button" onClick={() => navigate("/login")}>
                  Back to login
                </button>
              </div>
            ) : (
              <div className="auth-form">
                <p className="muted">
                  {page === "admin-reset-password"
                    ? "Set a new password for your admin account."
                    : "Set a new password for your staff account."}
                </p>
                <label>
                  New password
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    disabled={resetBusy}
                  />
                </label>
                <label>
                  Confirm password
                  <input
                    type="password"
                    value={resetPasswordConfirm}
                    onChange={(event) => setResetPasswordConfirm(event.target.value)}
                    disabled={resetBusy}
                  />
                </label>
                {resetError ? <p className="auth-error">{resetError}</p> : null}
                {resetNotice ? <p className="auth-notice">{resetNotice}</p> : null}
                <button
                  className="btn solid"
                  type="button"
                  onClick={async () => {
                    if (resetBusy) return;
                    setResetError("");
                    setResetNotice("");

                    const token = new URLSearchParams(location.search).get("token")?.trim();
                    if (!token) {
                      setResetError("Reset token is missing from this link.");
                      return;
                    }
                    if (!resetPassword || resetPassword.length < 6) {
                      setResetError("Password must be at least 6 characters.");
                      return;
                    }
                    if (resetPassword !== resetPasswordConfirm) {
                      setResetError("Passwords do not match.");
                      return;
                    }

                    setResetBusy(true);
                    try {
                      if (page === "admin-reset-password") {
                        await resetAdminPassword({ token, password: resetPassword });
                      } else {
                        await resetStaffPassword({ token, password: resetPassword });
                      }
                      setResetNotice("Password reset successful. You can now log in.");
                      setResetPassword("");
                      setResetPasswordConfirm("");
                    } catch (error) {
                      const message =
                        error instanceof ApiError || error instanceof Error
                          ? error.message
                          : "Could not reset password.";
                      setResetError(message);
                    } finally {
                      setResetBusy(false);
                    }
                  }}
                  disabled={resetBusy}
                >
                  {resetBusy ? "Resetting..." : "Reset password"}
                </button>
                <button className="btn ghost" type="button" onClick={() => navigate("/login")}> 
                  Back to login
                </button>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {page === "home" ? (
        <>
          <header className="landing-hero">
            <div className="landing-hero-panel">
              <div className="landing-hero-copy">
                <p className="landing-eyebrow">Modern attendance infrastructure</p>
                <h1>Attendance management, without the chaos.</h1>
                <p className="landing-lede">
                  Track staff attendance across teams and locations with real-time
                  visibility, automated rules, and reliable reporting — all in one
                  simple system.
                </p>
                <div className="landing-hero-badges">
                  <span className="badge">✔ No setup complexity</span>
                  <span className="badge">✔ Works for teams of all sizes</span>
                  <span className="badge">✔ Real-time insights</span>
                </div>
                <div className="landing-cta">
                  <Link className="btn solid" to="/signup">
                    Get Started Free
                  </Link>
                  <Link className="btn ghost" to="/contact">
                    Book a demo
                  </Link>
                </div>
              </div>
              <div className="landing-hero-visual">
                <div className="hero-image-frame">
                  <div className="hero-phone primary" aria-hidden="true">
                    {heroImages.map((src, idx) => (
                      <img
                        key={src}
                        src={src}
                        alt="Attendance dashboard preview"
                        className={`hero-phone-layer ${idx === heroIndex ? "active" : ""}`}
                      />
                    ))}
                  </div>
                </div>
              {heroImages.length > 1 ? (
                <div className="hero-dots" aria-hidden="true">
                  {heroImages.map((_, idx) => (
                    <span
                      key={idx}
                      className={`hero-dot ${idx === heroIndex ? "active" : ""}`}
                    />
                  ))}
                </div>
              ) : null}
              </div>
            </div>
            <div className="landing-hero-card">
              <div>
                <p className="landing-card-label">Clarity at a glance</p>
                <h3>Present, absent, and late updates in real time.</h3>
              </div>
              <div className="landing-metric">
                <span>
                  <span className="icon-dot" />
                  Present now
                </span>
                <strong>84</strong>
              </div>
              <div className="landing-metric">
                <span>
                  <span className="icon-dot" />
                  Absent today
                </span>
                <strong>7</strong>
              </div>
              <div className="landing-metric">
                <span>
                  <span className="icon-dot" />
                  Late check-ins
                </span>
                <strong>12</strong>
              </div>
              <p className="muted">Live activity feed updates as staff sign in and out.</p>
            </div>
          </header>

          <section className="landing-section">
            <div className="value-strip">
              <strong>Trusted by growing teams and organizations</strong>
              <div className="value-strip-items">
                <span className="badge">HR teams</span>
                <span className="badge">Schools</span>
                <span className="badge">SMEs</span>
                <span className="badge">Field teams</span>
              </div>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-section-header">
              <h2>Everything you need to manage attendance efficiently</h2>
              <p className="muted">
                Built for visibility, automation, and control across organizations.
              </p>
            </div>
            <div className="landing-grid">
              <div className="landing-card">
                <div className="landing-card-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 4l2.2 4.5L19 9.1l-3.5 3.4.8 4.8L12 15.8 7.7 17.3l.8-4.8L5 9.1l4.8-.6L12 4z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <h3>Real-time Visibility</h3>
                <p className="muted">
                  Instantly see who is present, absent, or late across your
                  organization.
                </p>
              </div>
              <div className="landing-card">
                <div className="landing-card-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 6h16v3H4V6zm0 5h16v7H4v-7zm3 2v3h3v-3H7z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <h3>Smart Attendance Rules</h3>
                <p className="muted">
                  Automate late flags, shift rules, and working hours with ease.
                </p>
              </div>
              <div className="landing-card">
                <div className="landing-card-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zm0 2l7 5 7-5H5z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <h3>Multi-Organization Support</h3>
                <p className="muted">
                  Manage multiple teams or branches from a single dashboard.
                </p>
              </div>
              <div className="landing-card">
                <div className="landing-card-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 3l8 4v6c0 4.4-3 8.4-8 9-5-.6-8-4.6-8-9V7l8-4zm0 2.2L6 8v5c0 3.3 2.1 6.4 6 7 3.9-.6 6-3.7 6-7V8l-6-2.8z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <h3>Role-Based Access</h3>
                <p className="muted">
                  Control what admins, managers, and staff can see and do.
                </p>
              </div>
              <div className="landing-card">
                <div className="landing-card-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 5h16v14H4V5zm2 2v10h12V7H6zm2 7h2v2H8v-2zm3-3h2v5h-2v-5zm3-4h2v9h-2V7z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <h3>Reports &amp; Insights</h3>
                <p className="muted">
                  Generate historical reports and export attendance data anytime.
                </p>
              </div>
              <div className="landing-card">
                <div className="landing-card-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 2a8 8 0 00-8 8v4H2v6h20v-6h-2v-4a8 8 0 00-8-8zm0 2a6 6 0 016 6v4H6v-4a6 6 0 016-6zm-3 12h6v2H9v-2z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <h3>Notifications &amp; Alerts</h3>
                <p className="muted">
                  Stay informed with real-time alerts on late check-ins and anomalies.
                </p>
              </div>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-section-header">
              <h2>Simple setup. Powerful results.</h2>
            </div>
            <div className="steps-grid">
              <article className="landing-card step-card">
                <p className="landing-card-label">Step 1</p>
                <h3>Create your organization</h3>
                <p className="muted">Set up your team structure in minutes.</p>
              </article>
              <article className="landing-card step-card">
                <p className="landing-card-label">Step 2</p>
                <h3>Add staff &amp; define rules</h3>
                <p className="muted">Assign roles, shifts, and attendance policies.</p>
              </article>
              <article className="landing-card step-card">
                <p className="landing-card-label">Step 3</p>
                <h3>Start tracking instantly</h3>
                <p className="muted">
                  Monitor attendance in real time with zero friction.
                </p>
              </article>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-section-header">
              <h2>Built for different kinds of teams</h2>
            </div>
            <div className="landing-grid">
              <article className="landing-card">
                <h3>Corporate teams</h3>
                <p className="muted">Structured attendance workflows and clean reporting.</p>
              </article>
              <article className="landing-card">
                <h3>Schools</h3>
                <p className="muted">Reliable student and staff attendance tracking.</p>
              </article>
              <article className="landing-card">
                <h3>Startups</h3>
                <p className="muted">Lightweight setup that scales as your team grows.</p>
              </article>
              <article className="landing-card">
                <h3>Field teams</h3>
                <p className="muted">Visibility across distributed teams and remote locations.</p>
              </article>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-section-header">
              <h2>Clarity at a glance</h2>
              <p className="muted">
                Monitor attendance trends, staff activity, and performance metrics from
                one intuitive dashboard.
              </p>
            </div>
            <div className="preview-panel">
              <div className="preview-grid">
                <div className="landing-card">
                  <h3>Status overview</h3>
                  <p className="muted">Present / Absent / Late snapshots in real time.</p>
                </div>
                <div className="landing-card">
                  <h3>Trends &amp; charts</h3>
                  <p className="muted">Weekly and monthly punctuality patterns by role.</p>
                </div>
                <div className="landing-card">
                  <h3>Live activity feed</h3>
                  <p className="muted">Know exactly when staff check in or check out.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-card">
              <p className="landing-eyebrow">Built for simplicity. Designed for scale.</p>
              <h2>A modern, lightweight attendance infrastructure for organizations.</h2>
              <p className="muted">
                We help organizations eliminate manual attendance tracking with a
                modern system that is easy to adopt, reliable to use, and powerful
                enough to grow with your team.
              </p>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-section-header">
              <h2>Flexible plans for every stage</h2>
              <p className="muted">
                Includes event attendance and geo-fencing across all tiers. No hidden
                fees. Cancel anytime.
              </p>
            </div>
            <div className="plans">
              <div className="plan-card">
                <h3>Starter</h3>
                <p className="plan-price">Free</p>
                <p className="muted">Free forever for small teams getting started.</p>
                <ul>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Daily sign-in and sign-out
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Geo-fencing for sign-in and sign-out
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Disposable event attendance (up to 3 events)
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Organization staff list
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Late and early flags
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Admins: 1
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Staff: up to 20
                  </li>
                </ul>
                <button className="btn ghost" type="button">
                  Get started
                </button>
              </div>
              <div className="plan-card highlight">
                <h3>Plus</h3>
                <p className="plan-price">NGN 45,000 / month</p>
                <p className="muted">Best for growing teams that need insights and automation.</p>
                <ul>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Geo-fencing for sign-in and sign-out
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Disposable event attendance (up to 10 events)
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Recurring disposable attendance events
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Event attendance export (CSV)
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Shift and role analytics
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Manager notifications
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Priority support
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Admins: 3
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Staff: up to 100
                  </li>
                </ul>
                <button className="btn solid" type="button">
                  Choose Plus
                </button>
              </div>
              <div className="plan-card">
                <h3>Pro</h3>
                <p className="plan-price">NGN 120,000 / month</p>
                <p className="muted">
                  Advanced tools for large organizations and multi-location operations.
                </p>
                <ul>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Geo-fencing for sign-in and sign-out
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Disposable event attendance (unlimited events)
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Recurring disposable attendance events
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Event attendance export (CSV)
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Multi-location dashboards
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Custom attendance rules
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Payroll integrations
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Dedicated success manager
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Admins: 10
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Staff: unlimited
                  </li>
                </ul>
                <button className="btn ghost" type="button">
                  Talk to sales
                </button>
              </div>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-footer">
              <div>
                <h2>Start tracking attendance the smarter way</h2>
                <p className="muted">
                  Join organizations already simplifying their attendance processes.
                </p>
              </div>
              <div className="final-cta-actions">
                <Link className="btn solid" to="/signup">
                  Get Started Free
                </Link>
                <Link className="btn ghost" to="/contact">
                  Talk to Sales
                </Link>
              </div>
            </div>
          </section>

          <section className="landing-section">
            <div className="contact-grid">
              <article className="contact-card">
                <h3>Email</h3>
                <a className="contact-link" href="mailto:hello@attendance.app">
                  hello@attendance.app
                </a>
              </article>
              <article className="contact-card">
                <h3>Phone</h3>
                <a className="contact-link" href="tel:+2348107050824">
                  +234 810 705 0824
                </a>
              </article>
              <article className="contact-card">
                <h3>Location</h3>
                <p className="muted">Lagos, Nigeria</p>
              </article>
            </div>
            <div className="landing-contact-note">
              <p className="muted">We typically respond within 24 hours.</p>
            </div>
          </section>
        </>
      ) : null}

      {page === "about" ? (
        <section className="info-page about-page">
          <div className="info-hero">
            <div>
              <p className="landing-eyebrow">About Attendance</p>
              <h1>We build confidence in every workday.</h1>
              <p className="landing-lede">
                Our mission is to help organizations capture time, trust, and momentum
                across distributed teams.
              </p>
            </div>
            <div className="info-hero-card">
              <h3>Our story</h3>
              <p className="muted">
                Attendance started as a simple sign-in tool and grew into a full
                workforce visibility platform for modern teams.
              </p>
            </div>
          </div>
          <div className="info-grid">
            <div className="info-card">
              <h3>Reliability</h3>
              <p className="muted">
                Always-on attendance tracking so managers have real-time visibility.
              </p>
            </div>
            <div className="info-card">
              <h3>Clarity</h3>
              <p className="muted">
                Clear signals for late arrivals, early departures, and trends.
              </p>
            </div>
            <div className="info-card">
              <h3>Growth</h3>
              <p className="muted">
                A platform that scales with your organization, location, and roles.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {page === "contact" ? (
        <section className="info-page contact-page">
          <div className="info-hero">
            <div>
              <p className="landing-eyebrow">Contact us</p>
              <h1>We are ready to help.</h1>
              <p className="landing-lede">
                Reach out for demos, onboarding help, or a custom plan for your team.
              </p>
            </div>
            <div className="info-hero-card">
              <h3>Support channels</h3>
              <p className="muted">Email, phone, or book a call with our team.</p>
            </div>
          </div>
          <div className="contact-grid">
            <div className="contact-card">
              <h3>Email</h3>
              <a className="contact-link" href="mailto:hello@attendance.app">
                hello@attendance.app
              </a>
              <p className="muted">Response within 24 hours.</p>
            </div>
            <div className="contact-card">
              <h3>Phone</h3>
              <a className="contact-link" href="tel:+2348107050824">
                +234 810 705 0824
              </a>
              <p className="muted">Mon-Fri, 9am-6pm WAT.</p>
            </div>
            <div className="contact-card">
              <h3>Office</h3>
              <p className="muted">Lagos, Nigeria</p>
              <p className="muted">By appointment only.</p>
            </div>
          </div>
        </section>
      ) : null}

      {page === "faqs" ? (
        <section className="info-page">
          <div className="info-hero">
            <div>
              <p className="landing-eyebrow">FAQs</p>
              <h1>Quick answers to common questions.</h1>
              <p className="landing-lede">
                Everything you need to know before bringing Attendance to your team.
              </p>
            </div>
            <div className="info-hero-card">
              <h3>Need more help?</h3>
              <p className="muted">Contact us anytime and we will respond quickly.</p>
            </div>
          </div>
          <div className="faq-list">
            {faqEntries.map((item) => {
              const isOpen = openFaqId === item.id;
              return (
                <article key={item.id} className={`faq-item ${isOpen ? "open" : ""}`}>
                  <button
                    className="faq-question"
                    type="button"
                    onClick={() => setOpenFaqId((current) => (current === item.id ? null : item.id))}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${item.id}`}
                  >
                    <span>{item.question}</span>
                    <span className="faq-indicator" aria-hidden="true">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  {isOpen ? (
                    <p id={`faq-answer-${item.id}`} className="faq-answer muted">
                      {item.answer}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {page === "plans" ? (
        <section className="info-page">
          <div className="info-hero">
            <div>
              <p className="landing-eyebrow">Plans</p>
              <h1>Choose the right plan for your organization.</h1>
              <div className="info-hero-card inline">
                <h3>Need a custom plan?</h3>
                <p className="muted">We can tailor a package for large teams.</p>
              </div>
              <p className="landing-lede">
                Start free, then scale event attendance, exports, recurring schedules,
                and geo-fenced sign-in/sign-out.
              </p>
            </div>
          </div>
          <div className="plans">
            <div className="plan-card">
              <h3>Starter</h3>
              <p className="plan-price">Free</p>
                <ul>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Daily sign-in and sign-out
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Geo-fencing for sign-in and sign-out
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Disposable event attendance (up to 3 events)
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Organization staff list
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Late and early flags
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Admins: 1
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Staff: up to 20
                  </li>
                </ul>
              <button className="btn ghost" type="button">
                Get started
              </button>
            </div>
            <div className="plan-card highlight">
              <h3>Plus</h3>
              <p className="plan-price">NGN 45,000 / month</p>
                <ul>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Geo-fencing for sign-in and sign-out
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Disposable event attendance (up to 10 events)
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Recurring disposable attendance events
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Event attendance export (CSV)
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Shift and role analytics
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Manager notifications
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Priority support
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Admins: 3
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Staff: up to 100
                  </li>
                </ul>
              <button className="btn solid" type="button">
                Choose Plus
              </button>
            </div>
            <div className="plan-card">
              <h3>Pro</h3>
              <p className="plan-price">NGN 120,000 / month</p>
                <ul>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Geo-fencing for sign-in and sign-out
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Disposable event attendance (unlimited events)
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Recurring disposable attendance events
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Event attendance export (CSV)
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Multi-location dashboards
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Custom attendance rules
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Payroll integrations
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Dedicated success manager
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Admins: 10
                  </li>
                  <li>
                    <span className="plan-icon" aria-hidden="true" />
                    Staff: unlimited
                  </li>
                </ul>
              <button className="btn ghost" type="button">
                Talk to sales
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <footer className="site-footer">
        <div className="footer-brand">
          <div className="footer-mark">A</div>
          <div>
            <strong>Attendance</strong>
            <p className="muted">Modern attendance clarity for growing teams.</p>
          </div>
        </div>
        <div className="footer-links">
          <div>
            <h4>Product</h4>
            <Link to="/" className="footer-link">
              Features
            </Link>
            <Link to="/plans" className="footer-link">
              Pricing
            </Link>
            <Link to="/faqs" className="footer-link">
              Security
            </Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link to="/about" className="footer-link">
              About
            </Link>
            <Link to="/about" className="footer-link">
              Careers
            </Link>
            <Link to="/about" className="footer-link">
              Press
            </Link>
          </div>
          <div>
            <h4>Support</h4>
            <a href="mailto:hello@attendance.app" className="footer-link">
              Email us
            </a>
            <a href="tel:+2348107050824" className="footer-link">
              Call us
            </a>
            <Link to="/contact" className="footer-link">
              Help center
            </Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span className="muted">© 2026 Attendance. All rights reserved.</span>
          <div className="footer-socials">
            <a className="footer-link" href="#">
              LinkedIn
            </a>
            <a className="footer-link" href="#">
              Twitter
            </a>
            <a className="footer-link" href="#">
              Instagram
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;




