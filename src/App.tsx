import { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { AttendanceRecord, OrgSettings, Organization, StaffMember } from "./types";
import {
  addStaff,
  createOrganization,
  deleteOrganization,
  getOrganization,
  getMe,
  listAttendanceForDate,
  listOrganizations,
  loginAdmin,
  logoutAdmin,
  signInStaff,
  signOutStaff,
  updateOrganization,
  updateSettings
} from "./lib/api";
import { formatDateLong, getTodayISO } from "./lib/time";
import AttendanceTable from "./components/AttendanceTable";
import OrgSelector from "./components/OrgSelector";
import StaffOnboarding from "./components/StaffOnboarding";
import DateSelector from "./components/DateSelector";
import AdminSettings from "./components/AdminSettings";
import AdminDashboard from "./components/AdminDashboard";
import StaffDashboard from "./components/StaffDashboard";
import ConfirmModal from "./components/ConfirmModal";
import OrganizationsPage from "./components/OrganizationsPage";
import AnalyticsPage from "./components/AnalyticsPage";

type ViewMode = "admin" | "staff";

type PendingAction = {
  staffId: string;
  staffName: string;
  type: "sign-in" | "sign-out";
} | null;


const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isOrganizationsPage = location.pathname === "/app/organizations";
  const isAnalyticsPage = location.pathname === "/app/analytics";
  const isSettingsPage = location.pathname === "/app/settings";
  const isDashboardPage = location.pathname === "/app";
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [attendanceForDate, setAttendanceForDate] = useState<AttendanceRecord[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState(
    ""
  );
  const [staffEmail, setStaffEmail] = useState("");
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminSession, setAdminSession] = useState<{
    email: string;
    orgId: string;
  } | null>(null);
  const [staffSessionOrgId, setStaffSessionOrgId] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState<"admin" | "staff" | null>(null);
  const [showAdminGate, setShowAdminGate] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("staff");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgLocation, setNewOrgLocation] = useState("");
  const [orgNameDraft, setOrgNameDraft] = useState("");
  const [orgLocationDraft, setOrgLocationDraft] = useState("");
  const [busyAction, setBusyAction] = useState<{ id: string; label: string } | null>(
    null
  );
  const [navCompact, setNavCompact] = useState(false);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const todayISO = getTodayISO();
  const [selectedDateISO, setSelectedDateISO] = useState(todayISO);

  const visibleOrganizations = useMemo(() => organizations, [organizations]);

  const selectedOrg = useMemo(() => {
    return visibleOrganizations.find((org) => org.id === selectedOrgId) ?? null;
  }, [visibleOrganizations, selectedOrgId]);

  useEffect(() => {
    const hydrateAuth = async () => {
      try {
        const result = await getMe();
        if (result?.user?.email && result.user.orgId) {
          if (result.user.role === "admin") {
            setAdminSession({ email: result.user.email, orgId: result.user.orgId });
            setStaffSessionOrgId(null);
            setSessionRole("admin");
          } else {
            setAdminSession(null);
            setStaffSessionOrgId(result.user.orgId);
            setSessionRole("staff");
            setStaffEmail(result.user.email);
          }
          setSelectedOrgId(result.user.orgId);
          return;
        }
        setAdminSession(null);
        setStaffSessionOrgId(null);
        setSessionRole(null);
        navigate("/login", { replace: true });
      } catch {
        setAdminSession(null);
        setStaffSessionOrgId(null);
        setSessionRole(null);
        navigate("/login", { replace: true });
      }
    };
    void hydrateAuth();
  }, [navigate]);

  useEffect(() => {
    if (sessionRole !== "staff" || !staffSessionOrgId) return;
    if (selectedOrgId !== staffSessionOrgId) {
      setSelectedOrgId(staffSessionOrgId);
    }
  }, [sessionRole, selectedOrgId, staffSessionOrgId]);

  useEffect(() => {
    if (!selectedOrgId) return;
    const exists = organizations.some((org) => org.id === selectedOrgId);
    if (!exists) {
      if (sessionRole === "staff" && staffSessionOrgId) {
        setSelectedOrgId(staffSessionOrgId);
      } else {
        setSelectedOrgId(organizations[0]?.id ?? "");
      }
    }
  }, [organizations, selectedOrgId, sessionRole, staffSessionOrgId]);

  useEffect(() => {
    if (!selectedOrg) {
      setOrgNameDraft("");
      setOrgLocationDraft("");
      return;
    }
    setOrgNameDraft(selectedOrg.name);
    setOrgLocationDraft(selectedOrg.location);
  }, [selectedOrg]);

  useEffect(() => {
    const handleScroll = () => {
      setNavCompact(window.scrollY > 24);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const refreshOrganizations = async () => {
    const orgs = await listOrganizations();
    setOrganizations(orgs);
    if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
    return orgs;
  };

  useEffect(() => {
    void refreshOrganizations();
  }, []);

  useEffect(() => {
    if (!selectedOrg) {
      setAttendanceForDate([]);
      return;
    }
    void listAttendanceForDate(selectedOrg.id, selectedDateISO).then(setAttendanceForDate);
  }, [selectedOrg, selectedDateISO]);

  const runWithBusy = async (
    id: string,
    label: string,
    action: () => Promise<void>,
    onDone?: () => void
  ) => {
    if (busyAction) return;
    setBusyAction({ id, label });
    try {
      await action();
    } finally {
      window.setTimeout(() => {
        setBusyAction(null);
        onDone?.();
      }, 350);
    }
  };

  const handleAddOrganization = async () => {
    if (sessionOrgId) return;
    if (orgLimitReached) return;
    if (!newOrgName || !newOrgLocation) return;
    await runWithBusy("add-org", "Adding organization...", async () => {
      const org = await createOrganization({
        name: newOrgName.trim(),
        location: newOrgLocation.trim()
      });
      await refreshOrganizations();
      if (org?.id) {
        setSelectedOrgId(org.id);
      }
      setNewOrgName("");
      setNewOrgLocation("");
    });
  };

  const handleUpdateOrganization = async () => {
    if (!selectedOrg) return;
    await runWithBusy("update-org", "Saving organization...", async () => {
      await updateOrganization(selectedOrg.id, {
        name: orgNameDraft.trim(),
        location: orgLocationDraft.trim()
      });
      await refreshOrganizations();
    });
  };

  const handleDeleteOrganization = async () => {
    if (!selectedOrg) return;
    if (!window.confirm(`Remove ${selectedOrg.name}? This cannot be undone.`)) {
      return;
    }
    await runWithBusy("remove-org", "Removing organization...", async () => {
      await deleteOrganization(selectedOrg.id);
      const orgs = await refreshOrganizations();
      setSelectedOrgId(orgs[0]?.id ?? "");
    });
  };

  const handleAddStaff = async (payload: Omit<StaffMember, "id">) => {
    if (!selectedOrg) return;
    if (staffLimitReached) return;
    await runWithBusy("add-staff", "Adding staff member...", async () => {
      await addStaff({
        organizationId: selectedOrg.id,
        fullName: payload.fullName,
        role: payload.role,
        email: payload.email
      });
      const refreshed = await getOrganization(selectedOrg.id);
      setOrganizations((prev) =>
        prev.map((org) => (org.id === refreshed.id ? refreshed : org))
      );
    });
  };

  const handleUpdateSettings = async (settings: OrgSettings) => {
    if (!selectedOrg) return;
    await runWithBusy("update-settings", "Saving settings...", async () => {
      const updated = await updateSettings(selectedOrg.id, settings);
      setOrganizations((prev) =>
        prev.map((org) =>
          org.id === selectedOrg.id ? { ...org, settings: updated } : org
        )
      );
    });
  };

  const performSignIn = async (staffId: string) => {
    if (!selectedOrg) return;
    const position = await getCurrentPositionForAttendance();
    await signInStaff({
      organizationId: selectedOrg.id,
      staffId,
      dateISO: selectedDateISO,
      latitude: position?.latitude,
      longitude: position?.longitude
    });
    const records = await listAttendanceForDate(selectedOrg.id, selectedDateISO);
    setAttendanceForDate(records);
  };

  const performSignOut = async (staffId: string) => {
    if (!selectedOrg) return;
    const position = await getCurrentPositionForAttendance();
    await signOutStaff({
      organizationId: selectedOrg.id,
      staffId,
      dateISO: selectedDateISO,
      latitude: position?.latitude,
      longitude: position?.longitude
    });
    const records = await listAttendanceForDate(selectedOrg.id, selectedDateISO);
    setAttendanceForDate(records);
  };

  const getCurrentPositionForAttendance = async (): Promise<
    { latitude: number; longitude: number } | null
  > => {
    if (!isStaffSession) {
      return null;
    }
    if (!("geolocation" in navigator)) {
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  const requestAction = (staffId: string, type: "sign-in" | "sign-out") => {
    if (!selectedOrg) return;
    if (selectedDateISO !== todayISO) return;
    const staff = selectedOrg.staff.find((person) => person.id === staffId);
    if (!staff) return;
    if (isStaffSession) {
      const loggedInStaffEmail = staffEmail.trim().toLowerCase();
      if (!loggedInStaffEmail || loggedInStaffEmail !== staff.email.toLowerCase()) {
        return;
      }
    }
    if (
      !isAdmin &&
      selectedOrg.settings.attendanceEditPolicy === "self-only" &&
      staffEmail.trim().toLowerCase() !== staff.email.toLowerCase()
    ) {
      return;
    }
    setPendingAction({ staffId, staffName: staff.fullName, type });
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    const actionId =
      pendingAction.type === "sign-in"
        ? `sign-in-${pendingAction.staffId}`
        : `sign-out-${pendingAction.staffId}`;
    const actionLabel =
      pendingAction.type === "sign-in" ? "Signing in..." : "Signing out...";
    await runWithBusy(
      actionId,
      actionLabel,
      async () => {
        if (pendingAction.type === "sign-in") {
          await performSignIn(pendingAction.staffId);
        } else {
          await performSignOut(pendingAction.staffId);
        }
      },
      () => setPendingAction(null)
    );
  };

  const canEditToday = selectedDateISO === todayISO;
  const isAdmin = sessionRole === "admin";
  const isStaffSession = sessionRole === "staff";
  const sessionOrgId = adminSession?.orgId ?? null;
  const effectiveViewMode: ViewMode = isAdmin ? viewMode : "staff";

  const handleSwitchToAdmin = () => {
    setShowAdminGate(true);
  };

  const handleAdminAccess = async () => {
    if (!adminEmailInput.trim() || !adminPasswordInput.trim()) {
      return;
    }
    try {
      const result = await loginAdmin({
        email: adminEmailInput.trim(),
        password: adminPasswordInput
      });
      setAdminSession({ email: result.admin.email, orgId: result.admin.orgId });
      setSessionRole("admin");
      setSelectedOrgId(result.admin.orgId);
      setViewMode("admin");
      setShowAdminGate(false);
      setAdminPasswordInput("");
    } catch {
      setAdminPasswordInput("");
    }
  };

  const handleSwitchToStaff = () => {
    setViewMode("staff");
    setShowAdminGate(false);
  };

  const handleCloseAdminGate = () => {
    setShowAdminGate(false);
    setAdminEmailInput("");
    setAdminPasswordInput("");
  };

  const handleOpenOnboard = () => setShowOnboardModal(true);
  const handleCloseOnboard = () => setShowOnboardModal(false);

  const handleBackToLanding = () => {
    navigate("/login", { replace: true });
  };

  const handleRequestLogout = () => setShowLogoutConfirm(true);
  const handleCancelLogout = () => setShowLogoutConfirm(false);
  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await logoutAdmin();
    setAdminSession(null);
    setStaffSessionOrgId(null);
    setSessionRole(null);
    setViewMode("staff");
    handleBackToLanding();
  };

  const handleAddOrgFromPage = async (name: string, location: string) => {
    if (sessionOrgId) return;
    if (orgLimitReached) return;
    await runWithBusy("org-add", "Adding organization...", async () => {
      await createOrganization({ name, location });
      await refreshOrganizations();
    });
  };

  const handleUpdateOrgFromPage = async (
    orgId: string,
    name: string,
    location: string
  ) => {
    await runWithBusy(`org-save-${orgId}`, "Saving organization...", async () => {
      await updateOrganization(orgId, { name, location });
      await refreshOrganizations();
    });
  };

  const handleRemoveOrgFromPage = async (orgId: string) => {
    if (sessionOrgId && orgId !== sessionOrgId) return;
    const org = organizations.find((item) => item.id === orgId);
    if (org && !window.confirm(`Remove ${org.name}? This cannot be undone.`)) {
      return;
    }
    await runWithBusy(`org-remove-${orgId}`, "Removing organization...", async () => {
      await deleteOrganization(orgId);
      const orgs = await refreshOrganizations();
      if (selectedOrgId === orgId) {
        setSelectedOrgId(orgs[0]?.id ?? "");
      }
    });
  };

  const modalTitle = pendingAction
    ? pendingAction.type === "sign-in"
      ? `Confirm sign in`
      : `Confirm sign out`
    : "";
  const modalDescription = pendingAction
    ? pendingAction.type === "sign-in"
      ? `Sign in ${pendingAction.staffName} for today?`
      : `Sign out ${pendingAction.staffName} for today?`
    : "";

  const isBusy = Boolean(busyAction);
  const canEditStaffMember = (staff: StaffMember) => {
    if (!selectedOrg) return false;
    if (isStaffSession) {
      return staffEmail.trim().toLowerCase() === staff.email.toLowerCase();
    }
    if (isAdmin) return true;
    const policy = selectedOrg.settings.attendanceEditPolicy ?? "any";
    if (policy === "any") return true;
    return staffEmail.trim().toLowerCase() === staff.email.toLowerCase();
  };
  const orgPlanTier = selectedOrg?.settings.planTier ?? "free";
  const orgLimit =
    orgPlanTier === "pro" ? 10 : orgPlanTier === "plus" ? 3 : 1;
  const orgCount = organizations.length;
  const orgLimitReached = !sessionOrgId && orgCount >= orgLimit;
  const staffLimit = selectedOrg
    ? selectedOrg.settings.planTier === "pro"
      ? Infinity
      : selectedOrg.settings.planTier === "plus"
        ? 100
        : 20
    : 0;
  const staffLimitReached =
    Boolean(selectedOrg) &&
    staffLimit !== Infinity &&
    (selectedOrg?.staff.length ?? 0) >= staffLimit;

  return (
    <div className="app-shell with-fixed-nav">
      {busyAction ? (
        <div className="activity-bar" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>{busyAction.label}</span>
        </div>
      ) : null}

      <div className={`topbar admin-nav ${navCompact ? "compact" : ""}`}>
        <div className="nav-brand">
          <strong>{effectiveViewMode === "admin" ? "Admin view" : "Staff view"}</strong>
          <span className="nav-subtitle">
            {effectiveViewMode === "admin"
              ? "Settings and onboarding"
              : "Read-only for settings"}
          </span>
        </div>
        <div className="topbar-actions nav-links">
          {isDashboardPage ? null : (
            <button
              className="nav-pill"
              type="button"
              onClick={() => navigate("/app")}
            >
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation">
                  <path
                    d="M3 10.5L12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5.5v-6h-4v6h-5.5A1.5 1.5 0 0 1 3 19.5v-9Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              Dashboard
            </button>
          )}
          {effectiveViewMode === "admin" ? (
            <button className="nav-pill" type="button" onClick={handleSwitchToStaff}>
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation">
                  <path
                    d="M4 7h9m-9 5h12m-12 5h8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Switch to staff
            </button>
          ) : sessionRole === "admin" ? (
            <button className="nav-pill accent" type="button" onClick={handleSwitchToAdmin}>
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation">
                  <path
                    d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-6.5 15a6.5 6.5 0 0 1 13 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              Switch to admin
            </button>
          ) : null}
          {effectiveViewMode === "admin" ? (
            <button
              className={`nav-pill ${isOrganizationsPage ? "active" : ""}`}
              type="button"
              onClick={() =>
                navigate(isOrganizationsPage ? "/app" : "/app/organizations")
              }
            >
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation">
                  <path
                    d="M4 5h16v6H4V5Zm0 8h10v6H4v-6Zm12 0h4v6h-4v-6Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              {isOrganizationsPage ? "Back to dashboard" : "Organizations"}
            </button>
          ) : null}
          {effectiveViewMode === "admin" ? (
            <button
              className={`nav-pill ${isAnalyticsPage ? "active" : ""}`}
              type="button"
              onClick={() => navigate(isAnalyticsPage ? "/app" : "/app/analytics")}
            >
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation">
                  <path
                    d="M5 19V9m5 10V5m5 14v-6m5 6V8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              {isAnalyticsPage ? "Back to dashboard" : "Analytics"}
            </button>
          ) : null}
          {effectiveViewMode === "admin" ? (
            <button
              className={`nav-pill ${isSettingsPage ? "active" : ""}`}
              type="button"
              onClick={() => navigate(isSettingsPage ? "/app" : "/app/settings")}
            >
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation">
                  <path
                    d="M12 3.5 14 6.5l3.5.5-2.5 2.5.6 3.5-3.1-1.6-3.1 1.6.6-3.5L6.5 7l3.5-.5 2-3Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              {isSettingsPage ? "Back to dashboard" : "Settings"}
            </button>
          ) : null}
          {isStaffSession ? (
            <button className="nav-pill" type="button" onClick={handleRequestLogout}>
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation">
                  <path
                    d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 17l5-5-5-5M19 12H9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Log out
            </button>
          ) : null}
        </div>
      </div>

      {isOrganizationsPage && effectiveViewMode === "admin" ? (
        <main className="layout full">
          <OrganizationsPage
            organizations={visibleOrganizations}
            onAdd={handleAddOrgFromPage}
            onUpdate={handleUpdateOrgFromPage}
            onRemove={handleRemoveOrgFromPage}
            orgLimit={orgLimit}
            orgCount={orgCount}
            isBusy={isBusy}
            busyActionId={busyAction?.id ?? null}
          />
        </main>
      ) : isAnalyticsPage && effectiveViewMode === "admin" ? (
        <main className="layout full">
          <AnalyticsPage organization={selectedOrg} />
        </main>
      ) : isSettingsPage && effectiveViewMode === "admin" ? (
        <main className="layout full">
          <div className="panel settings-header">
            <div>
              <h2>Organization settings</h2>
              <p className="muted">
                Edit organization details, attendance rules, working days, and roles.
              </p>
            </div>
            <div className="settings-actions">
              <button
                className="btn ghost danger"
                type="button"
                onClick={handleRequestLogout}
              >
                Log out
              </button>
            </div>
          </div>
          <div className="admin-layout">
            <section className="panel admin-column">
              <OrgSelector
                organizations={visibleOrganizations}
                selectedOrgId={selectedOrgId}
                onSelect={setSelectedOrgId}
              />

              <div className="org-manager">
                <div className="panel-header">
                  <h3>Organization details</h3>
                  <p className="muted">Update name and location.</p>
                </div>
                <div className="org-form">
                  <label>
                    Organization name
                    <input
                      type="text"
                      value={orgNameDraft}
                      onChange={(event) => setOrgNameDraft(event.target.value)}
                      placeholder="Organization name"
                      disabled={!selectedOrg}
                    />
                  </label>
                  <label>
                    Location
                    <input
                      type="text"
                      value={orgLocationDraft}
                      onChange={(event) => setOrgLocationDraft(event.target.value)}
                      placeholder="Location"
                      disabled={!selectedOrg}
                    />
                  </label>
                  <div className="org-actions">
                    <button
                      className="btn solid"
                      type="button"
                      onClick={handleUpdateOrganization}
                      disabled={!selectedOrg || isBusy}
                    >
                      {busyAction?.id === "update-org"
                        ? "Saving..."
                        : "Save changes"}
                    </button>
                    {!sessionOrgId ? (
                      <button
                        className="btn ghost danger"
                        type="button"
                        onClick={handleDeleteOrganization}
                        disabled={!selectedOrg || isBusy}
                      >
                        {busyAction?.id === "remove-org"
                          ? "Removing..."
                          : "Remove organization"}
                      </button>
                    ) : null}
                  </div>
                </div>
                {!sessionOrgId ? (
                  <>
                    <div className="org-divider" />
                    <div className="org-form">
                      <label>
                        New organization name
                        <input
                          type="text"
                          value={newOrgName}
                          onChange={(event) => setNewOrgName(event.target.value)}
                          placeholder="New organization"
                          disabled={isBusy || orgLimitReached}
                        />
                      </label>
                      <label>
                        New organization location
                        <input
                          type="text"
                          value={newOrgLocation}
                          onChange={(event) => setNewOrgLocation(event.target.value)}
                          placeholder="City"
                          disabled={isBusy || orgLimitReached}
                        />
                      </label>
                      <button
                        className="btn solid"
                        type="button"
                        onClick={handleAddOrganization}
                        disabled={isBusy || orgLimitReached}
                      >
                        {orgLimitReached
                          ? "Organization limit reached"
                          : busyAction?.id === "add-org"
                            ? "Adding..."
                            : "Add organization"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="muted">
                    This account manages a single organization.
                  </p>
                )}
              </div>

              {selectedOrg ? (
                <div className="org-summary">
                  <h2>{selectedOrg.name}</h2>
                  <p>{selectedOrg.location}</p>
                  <div className="pill-row">
                    <span className="pill">{selectedOrg.staff.length} staff</span>
                    <span className="pill">{attendanceForDate.length} checked in</span>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <h3>No organization yet</h3>
                  <p className="muted">
                    Create your organization to start tracking attendance.
                  </p>
                  <button
                    className="btn solid"
                    type="button"
                    onClick={() => navigate("/signup")}
                  >
                    Create organization
                  </button>
                </div>
              )}
            </section>

            <section className="panel wide admin-column">
              {selectedOrg ? (
                <AdminSettings
                  settings={selectedOrg.settings}
                  onUpdate={handleUpdateSettings}
                  isBusy={isBusy}
                  primaryAdminEmail={adminSession?.email ?? ""}
                  orgId={selectedOrg.id}
                />
              ) : (
                <div className="empty-state">
                  <h3>No organization selected</h3>
                  <p>Select an organization to manage settings.</p>
                </div>
              )}
            </section>
          </div>
        </main>
      ) : (
        <main className="layout full">
          {effectiveViewMode === "admin" ? (
            <>
              {isDashboardPage ? (
                <section className="summary-row admin-summary-row">
                  <div className="summary-card summary-intro">
                    <p className="eyebrow">Staff Attendance</p>
                    <h2>Morning sign-in, evening sign-out for every organization.</h2>
                    <p className="muted">
                      Track daily attendance across multiple teams with a clear view of
                      who is clocked in, who is done, and who still needs a reminder.
                    </p>
                  </div>
                  <div className="summary-card summary-today">
                    <p className="summary-label">Today</p>
                    <p className="summary-date">{formatDateLong(todayISO)}</p>
                    <div className="summary-metric">
                      <span>Organizations</span>
                      <strong>{visibleOrganizations.length}</strong>
                    </div>
                    <div className="summary-metric">
                      <span>Staff on file</span>
                      <strong>
                        {visibleOrganizations.reduce(
                          (sum, org) => sum + org.staff.length,
                          0
                        )}
                      </strong>
                    </div>
                  </div>
                  <AdminDashboard organizations={visibleOrganizations} variant="card" />
                  <div className="summary-card summary-onboard">
                    <div>
                      <h2>Onboard staff</h2>
                      <p className="muted">
                        Add new team members and assign roles in seconds.
                      </p>
                    </div>
                    <button
                      className="btn solid cta-rect"
                      type="button"
                      onClick={handleOpenOnboard}
                      disabled={!selectedOrg || isBusy || staffLimitReached}
                    >
                      {staffLimitReached ? "Staff limit reached" : "Onboard staff"}
                    </button>
                  </div>
                  <div className="summary-card summary-org">
                    <OrgSelector
                      organizations={visibleOrganizations}
                      selectedOrgId={selectedOrgId}
                      onSelect={setSelectedOrgId}
                    />
                    <div className="identity-block">
                      <label>
                        Your email
                        <input
                          type="email"
                          value={staffEmail}
                          onChange={(event) => setStaffEmail(event.target.value)}
                          placeholder="you@company.com"
                        />
                      </label>
                      <p className="muted">
                        Used for self-only sign-ins when enabled by admin.
                      </p>
                    </div>
                    {selectedOrg ? (
                      <div className="summary-org-info">
                        <strong>{selectedOrg.name}</strong>
                        <span className="muted">{selectedOrg.location}</span>
                        <div className="pill-row">
                          <span className="pill">{selectedOrg.staff.length} staff</span>
                          <span className="pill">
                            {attendanceForDate.length} checked in
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="summary-org-info">
                        <strong>No organization yet</strong>
                        <span className="muted">
                          Create your organization to start tracking attendance.
                        </span>
                        {!isStaffSession ? (
                          <button
                            className="btn solid"
                            type="button"
                            onClick={() => navigate("/signup")}
                          >
                            Create organization
                          </button>
                        ) : null}
                      </div>
                    )}
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => navigate("/app/settings")}
                    >
                      Open settings
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="panel wide">
                <div className="panel-header header-row">
                  <div>
                    <h2>Attendance</h2>
                    <p className="muted">
                      {canEditToday
                        ? "Sign in or sign out as staff arrive and leave."
                        : "Viewing historical attendance. Changes are disabled."}
                    </p>
                  </div>
                  <DateSelector
                    selectedDate={selectedDateISO}
                    onChange={setSelectedDateISO}
                  />
                </div>
                {selectedOrg ? (
                  <AttendanceTable
                    staff={selectedOrg.staff}
                    attendance={attendanceForDate}
                    settings={selectedOrg.settings}
                    onSignIn={(staffId) => requestAction(staffId, "sign-in")}
                    onSignOut={(staffId) => requestAction(staffId, "sign-out")}
                    canEdit={canEditToday}
                    canEditStaff={canEditStaffMember}
                    isBusy={isBusy}
                  />
                ) : (
                  <div className="empty-state">
                    <h3>No organization selected</h3>
                    <p>Select an organization to manage attendance.</p>
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              {isDashboardPage ? (
                <section className="summary-row">
                  <div className="summary-card summary-intro">
                    <p className="eyebrow">Staff Attendance</p>
                    <h2>Morning sign-in, evening sign-out for every organization.</h2>
                    <p className="muted">
                      Track daily attendance across multiple teams with a clear view of
                      who is clocked in, who is done, and who still needs a reminder.
                    </p>
                  </div>
                  <StaffDashboard
                    organizations={visibleOrganizations}
                    selectedOrgId={selectedOrgId}
                    attendanceForDate={attendanceForDate}
                    variant="card"
                  />
                  <div className="summary-card summary-org">
                    {!isStaffSession ? (
                      <OrgSelector
                        organizations={visibleOrganizations}
                        selectedOrgId={selectedOrgId}
                        onSelect={setSelectedOrgId}
                      />
                    ) : null}
                    {selectedOrg ? (
                      <div className="summary-org-info">
                        <strong>{selectedOrg.name}</strong>
                        <span className="muted">{selectedOrg.location}</span>
                        <div className="pill-row">
                          <span className="pill">{selectedOrg.staff.length} staff</span>
                          <span className="pill">
                            {attendanceForDate.length} checked in
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="summary-org-info">
                        <strong>No organization yet</strong>
                        <span className="muted">
                          Create your organization to start tracking attendance.
                        </span>
                        {!isStaffSession ? (
                          <button
                            className="btn solid"
                            type="button"
                            onClick={() => navigate("/signup")}
                          >
                            Create organization
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </section>
              ) : null}

              <section className="panel wide">
                <div className="panel-header header-row">
                  <div>
                    <h2>Attendance</h2>
                    <p className="muted">
                      {canEditToday
                        ? "Sign in or sign out as staff arrive and leave."
                        : "Viewing historical attendance. Changes are disabled."}
                    </p>
                  </div>
                  <DateSelector
                    selectedDate={selectedDateISO}
                    onChange={setSelectedDateISO}
                  />
                </div>
                {selectedOrg ? (
                  <AttendanceTable
                    staff={selectedOrg.staff}
                    attendance={attendanceForDate}
                    settings={selectedOrg.settings}
                    onSignIn={(staffId) => requestAction(staffId, "sign-in")}
                    onSignOut={(staffId) => requestAction(staffId, "sign-out")}
                    canEdit={canEditToday}
                    canEditStaff={canEditStaffMember}
                    isBusy={isBusy}
                  />
                ) : (
                  <div className="empty-state">
                    <h3>No organization selected</h3>
                    <p>Select an organization to manage attendance.</p>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      )}

      <ConfirmModal
        isOpen={Boolean(pendingAction)}
        title={modalTitle}
        description={modalDescription}
        confirmLabel={pendingAction?.type === "sign-out" ? "Sign out" : "Sign in"}
        isLoading={Boolean(busyAction?.id?.startsWith("sign-"))}
        loadingLabel={busyAction?.label ?? "Working..."}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Log out"
        description="Are you sure you want to log out and return to the landing page?"
        confirmLabel="Log out"
        onConfirm={handleConfirmLogout}
        onCancel={handleCancelLogout}
      />

      {showAdminGate ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Admin access">
            <div className="modal-header">
              <h3>Admin access</h3>
            </div>
            <p className="muted">Enter your admin credentials to unlock settings.</p>
            <div className="gate-row">
              <input
                type="email"
                value={adminEmailInput}
                onChange={(event) => setAdminEmailInput(event.target.value)}
                placeholder="Admin email"
              />
              <input
                type="password"
                value={adminPasswordInput}
                onChange={(event) => setAdminPasswordInput(event.target.value)}
                placeholder="Password"
              />
              <button className="btn solid" type="button" onClick={handleAdminAccess}>
                Continue
              </button>
            </div>
            {adminEmailInput || adminPasswordInput ? (
              <p className="muted">Use your admin credentials to continue.</p>
            ) : null}
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={handleCloseAdminGate}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showOnboardModal ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal-wide" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Onboard staff</h3>
            </div>
            <StaffOnboarding
              onAddStaff={handleAddStaff}
              roles={selectedOrg?.settings.roles ?? []}
              disabled={!selectedOrg}
              limitReached={staffLimitReached}
              limitLabel={staffLimit === Infinity ? "Unlimited" : String(staffLimit)}
              isLoading={busyAction?.id === "add-staff"}
            />
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={handleCloseOnboard}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default App;

