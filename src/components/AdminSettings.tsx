import { useState } from "react";
import type { OrgSettings } from "../types";
import { registerAdmin, setOrganizationStaffPassword } from "../lib/api";

type Props = {
  settings: OrgSettings;
  onUpdate: (next: OrgSettings) => void;
  primaryAdminEmail: string;
  orgId: string;
  disabled?: boolean;
  isBusy?: boolean;
};

const AdminSettings = ({
  settings,
  onUpdate,
  primaryAdminEmail,
  orgId,
  disabled = false,
  isBusy = false
}: Props) => {
  const [roleInput, setRoleInput] = useState("");
  const [rolesOpen, setRolesOpen] = useState(true);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const [adminInput, setAdminInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [staffLoginPasswordInput, setStaffLoginPasswordInput] = useState("");
  const [staffLoginSaving, setStaffLoginSaving] = useState(false);
  const [locatingOffice, setLocatingOffice] = useState(false);
  const [officeLocationError, setOfficeLocationError] = useState("");

  const workingDays = settings.workingDays ?? [1, 2, 3, 4, 5];
  const adminLimit =
    settings.planTier === "pro" ? 10 : settings.planTier === "plus" ? 3 : 1;
  const normalizedPrimary = primaryAdminEmail.trim().toLowerCase();
  const adminEmails = settings.adminEmails ?? [];
  const totalAdmins = new Set(
    [normalizedPrimary, ...adminEmails.map((email) => email.toLowerCase())].filter(
      Boolean
    )
  ).size;
  const remainingAdmins = Math.max(adminLimit - totalAdmins, 0);

  const toggleWorkingDay = (day: number) => {
    const next = workingDays.includes(day)
      ? workingDays.filter((value) => value !== day)
      : [...workingDays, day];
    onUpdate({ ...settings, workingDays: next });
  };

  const handleAddRole = () => {
    const trimmed = roleInput.trim();
    if (!trimmed) return;
    if (settings.roles.some((role) => role.toLowerCase() === trimmed.toLowerCase())) {
      setRoleInput("");
      return;
    }
    onUpdate({ ...settings, roles: [...settings.roles, trimmed] });
    setRoleInput("");
  };

  const handleRemoveRole = (roleToRemove: string) => {
    onUpdate({
      ...settings,
      roles: settings.roles.filter((role) => role !== roleToRemove)
    });
  };

  const handleEditRole = (roleToEdit: string) => {
    setEditingRole(roleToEdit);
    setRoleDrafts((prev) => ({ ...prev, [roleToEdit]: roleToEdit }));
  };

  const handleSaveRole = (roleToSave: string) => {
    const nextName = (roleDrafts[roleToSave] ?? "").trim();
    if (!nextName) return;
    const duplicate = settings.roles.some(
      (role) => role.toLowerCase() === nextName.toLowerCase() && role !== roleToSave
    );
    if (duplicate) return;
    const nextRoles = settings.roles.map((role) =>
      role === roleToSave ? nextName : role
    );
    onUpdate({ ...settings, roles: nextRoles });
    setEditingRole(null);
  };

  const handleAddAdmin = () => {
    const trimmed = adminInput.trim().toLowerCase();
    if (!trimmed || !adminPasswordInput.trim()) return;
    if (trimmed === normalizedPrimary) {
      setAdminInput("");
      setAdminPasswordInput("");
      return;
    }
    if (adminEmails.some((email) => email.toLowerCase() === trimmed)) {
      setAdminInput("");
      setAdminPasswordInput("");
      return;
    }
    if (remainingAdmins <= 0) return;

    registerAdmin({ orgId, email: trimmed, password: adminPasswordInput })
      .then(() => {
        onUpdate({ ...settings, adminEmails: [...adminEmails, trimmed] });
      })
      .finally(() => {
        setAdminInput("");
        setAdminPasswordInput("");
      });
  };

  const handleRemoveAdmin = (emailToRemove: string) => {
    onUpdate({
      ...settings,
      adminEmails: adminEmails.filter((email) => email !== emailToRemove)
    });
  };

  const handleSaveStaffLoginPassword = () => {
    const trimmed = staffLoginPasswordInput.trim();
    if (!trimmed || staffLoginSaving) return;
    setStaffLoginSaving(true);
    setOrganizationStaffPassword({ orgId, password: trimmed })
      .then(() => undefined)
      .finally(() => {
        setStaffLoginSaving(false);
      });
  };

  const handleUseCurrentLocation = () => {
    if (locatingOffice || disabled || isBusy) return;
    if (!("geolocation" in navigator)) {
      setOfficeLocationError("Geolocation is not supported on this device.");
      return;
    }

    setOfficeLocationError("");
    setLocatingOffice(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onUpdate({
          ...settings,
          officeGeoFenceEnabled: true,
          officeLatitude: Number(position.coords.latitude.toFixed(6)),
          officeLongitude: Number(position.coords.longitude.toFixed(6))
        });
        setLocatingOffice(false);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location permission denied. Please allow location access."
            : error.code === error.POSITION_UNAVAILABLE
              ? "Unable to determine current location."
              : "Location request timed out. Please try again.";
        setOfficeLocationError(message);
        setLocatingOffice(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <section className="admin-settings">
      <details className="role-settings settings-block" open>
        <summary className="settings-summary">
          <h3>Plan tier</h3>
          <p className="muted">Controls admin limits and advanced capabilities.</p>
        </summary>
        <label>
          Current plan
          <select
            value={settings.planTier}
            onChange={(event) => {
              const nextPlan = event.target.value as OrgSettings["planTier"];
              const nextLimit = nextPlan === "pro" ? 10 : nextPlan === "plus" ? 3 : 1;
              const allowedExtras = Math.max(nextLimit - 1, 0);
              onUpdate({
                ...settings,
                planTier: nextPlan,
                adminEmails: adminEmails.slice(0, allowedExtras)
              });
            }}
            disabled={disabled || isBusy}
          >
            <option value="free">Free</option>
            <option value="plus">Plus</option>
            <option value="pro">Pro</option>
          </select>
        </label>
      </details>

      <details className="role-settings settings-block">
        <summary className="settings-summary">
          <h3>Admins</h3>
          <p className="muted">
            {totalAdmins} of {adminLimit} admin slots used.
          </p>
        </summary>
        <label>
          Add admin email
          <div className="role-input">
            <input
              type="email"
              value={adminInput}
              onChange={(event) => setAdminInput(event.target.value)}
              placeholder="admin@company.com"
              disabled={disabled || isBusy || remainingAdmins <= 0}
            />
            <input
              type="password"
              value={adminPasswordInput}
              onChange={(event) => setAdminPasswordInput(event.target.value)}
              placeholder="Temporary password"
              disabled={disabled || isBusy || remainingAdmins <= 0}
            />
            <button
              className="btn solid"
              type="button"
              onClick={handleAddAdmin}
              disabled={disabled || isBusy || remainingAdmins <= 0}
            >
              {remainingAdmins <= 0 ? "Limit reached" : "Add admin"}
            </button>
          </div>
        </label>
        <div className="role-list">
          <div className="role-chip">
            <span>{primaryAdminEmail}</span>
            <div className="role-actions">
              <span className="muted">Primary admin</span>
            </div>
          </div>
          {adminEmails.map((email) => (
            <div className="role-chip" key={email}>
              <span>{email}</span>
              <div className="role-actions">
                <button
                  type="button"
                  onClick={() => handleRemoveAdmin(email)}
                  disabled={disabled || isBusy}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {adminEmails.length === 0 ? (
            <p className="muted">No additional admins yet.</p>
          ) : null}
        </div>
      </details>

      <details className="role-settings settings-block">
        <summary className="settings-summary">
          <h3>Staff login password</h3>
          <p className="muted">
            Set one password that all staff in this organization use to log in.
          </p>
        </summary>
        <label>
          Shared staff password
          <div className="role-input">
            <input
              type="text"
              value={staffLoginPasswordInput}
              onChange={(event) => setStaffLoginPasswordInput(event.target.value)}
              placeholder="Enter shared password"
              disabled={disabled || isBusy || staffLoginSaving}
            />
            <button
              className="btn solid"
              type="button"
              onClick={handleSaveStaffLoginPassword}
              disabled={
                disabled ||
                isBusy ||
                staffLoginSaving ||
                !staffLoginPasswordInput.trim()
              }
            >
              {staffLoginSaving ? "Saving..." : "Save password"}
            </button>
          </div>
        </label>
      </details>

      <details className="role-settings settings-block">
        <summary className="settings-summary">
          <h3>Attendance rules</h3>
          <p className="muted">Late and early checkout thresholds are set here.</p>
        </summary>
        <label>
          Late if check-in after
          <input
            type="time"
            value={settings.lateAfterTime}
            onChange={(event) =>
              onUpdate({ ...settings, lateAfterTime: event.target.value })
            }
            disabled={disabled || isBusy}
          />
        </label>
        <label>
          Early if check-out before
          <input
            type="time"
            value={settings.earlyCheckoutBeforeTime}
            onChange={(event) =>
              onUpdate({ ...settings, earlyCheckoutBeforeTime: event.target.value })
            }
            disabled={disabled || isBusy}
          />
        </label>
      </details>

      <details className="role-settings settings-block">
        <summary className="settings-summary">
          <h3>Office geofence</h3>
          <p className="muted">
            Require staff to be physically in office before sign in/out is allowed.
          </p>
        </summary>
        <label className="toggle-pill">
          <input
            type="checkbox"
            checked={settings.officeGeoFenceEnabled}
            onChange={(event) =>
              onUpdate({
                ...settings,
                officeGeoFenceEnabled: event.target.checked
              })
            }
            disabled={disabled || isBusy}
          />
          <span>Enforce office location for staff attendance actions</span>
        </label>
        <div className="role-input">
          <label>
            Office latitude
            <input
              type="number"
              step="any"
              value={settings.officeLatitude ?? ""}
              onChange={(event) =>
                onUpdate({
                  ...settings,
                  officeLatitude:
                    event.target.value.trim() === ""
                      ? null
                      : Number(event.target.value)
                })
              }
              disabled={disabled || isBusy}
            />
          </label>
          <label>
            Office longitude
            <input
              type="number"
              step="any"
              value={settings.officeLongitude ?? ""}
              onChange={(event) =>
                onUpdate({
                  ...settings,
                  officeLongitude:
                    event.target.value.trim() === ""
                      ? null
                      : Number(event.target.value)
                })
              }
              disabled={disabled || isBusy}
            />
          </label>
          <label>
            Allowed radius (meters)
            <input
              type="number"
              min={1}
              value={settings.officeRadiusMeters}
              onChange={(event) =>
                onUpdate({
                  ...settings,
                  officeRadiusMeters: Math.max(1, Number(event.target.value) || 150)
                })
              }
              disabled={disabled || isBusy}
            />
          </label>
          <div className="office-location-actions">
            <button
              className="btn ghost"
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={disabled || isBusy || locatingOffice}
            >
              {locatingOffice ? "Getting location..." : "Use current location"}
            </button>
            {officeLocationError ? (
              <p className="muted" role="status">
                {officeLocationError}
              </p>
            ) : null}
          </div>
        </div>
      </details>

      <details className="role-settings settings-block">
        <summary className="settings-summary">
          <h3>Sign-in permissions</h3>
          <p className="muted">
            Control whether staff can sign in/out for others or only themselves.
          </p>
        </summary>
        <label className="toggle-pill">
          <input
            type="radio"
            name="attendance-policy"
            checked={settings.attendanceEditPolicy === "any"}
            onChange={() =>
              onUpdate({ ...settings, attendanceEditPolicy: "any" })
            }
            disabled={disabled || isBusy}
          />
          <span>Anyone can sign in/out for others</span>
        </label>
        <label className="toggle-pill">
          <input
            type="radio"
            name="attendance-policy"
            checked={settings.attendanceEditPolicy === "self-only"}
            onChange={() =>
              onUpdate({ ...settings, attendanceEditPolicy: "self-only" })
            }
            disabled={disabled || isBusy}
          />
          <span>Only the logged-in email can sign in/out for itself</span>
        </label>
      </details>

      <details className="role-settings settings-block">
        <summary className="settings-summary">
          <h3>Working days</h3>
          <p className="muted">Choose which days count toward attendance analytics.</p>
        </summary>
        <div className="workdays-grid">
          {[
            { label: "Mon", value: 1 },
            { label: "Tue", value: 2 },
            { label: "Wed", value: 3 },
            { label: "Thu", value: 4 },
            { label: "Fri", value: 5 },
            { label: "Sat", value: 6 },
            { label: "Sun", value: 0 }
          ].map((day) => (
            <label className="workday-chip" key={day.value}>
              <input
                type="checkbox"
                checked={workingDays.includes(day.value)}
                onChange={() => toggleWorkingDay(day.value)}
                disabled={disabled || isBusy}
              />
              <span>{day.label}</span>
            </label>
          ))}
        </div>
        <label className="toggle-pill">
          <input
            type="checkbox"
            checked={settings.analyticsIncludeFutureDays}
            onChange={(event) =>
              onUpdate({
                ...settings,
                analyticsIncludeFutureDays: event.target.checked
              })
            }
            disabled={disabled || isBusy}
          />
          <span>Include future working days in analytics</span>
        </label>
      </details>

      <details className="role-settings settings-block">
        <summary className="settings-summary">
          <h3>Roles</h3>
          <p className="muted">Create organization roles used during onboarding.</p>
        </summary>
        <div className="role-header">
          <button
            className="btn ghost"
            type="button"
            onClick={() => setRolesOpen((prev) => !prev)}
          >
            {rolesOpen ? "Hide roles" : `Show roles (${settings.roles.length})`}
          </button>
        </div>
        <div className="role-input">
          <input
            type="text"
            value={roleInput}
            onChange={(event) => setRoleInput(event.target.value)}
            placeholder="Add a new role"
            disabled={disabled || isBusy}
          />
          <button
            className="btn solid"
            type="button"
            onClick={handleAddRole}
            disabled={disabled || isBusy}
          >
            {isBusy ? "Saving..." : "Add role"}
          </button>
        </div>
        <div className={`role-list ${rolesOpen ? "" : "collapsed"}`}>
          {settings.roles.map((role) => (
            <div className="role-chip" key={role}>
              {editingRole === role ? (
                <>
                  <input
                    className="role-edit-input"
                    type="text"
                    value={roleDrafts[role] ?? ""}
                    onChange={(event) =>
                      setRoleDrafts((prev) => ({
                        ...prev,
                        [role]: event.target.value
                      }))
                    }
                    disabled={disabled || isBusy}
                  />
                  <div className="role-actions">
                    <button
                      type="button"
                      onClick={() => handleSaveRole(role)}
                      disabled={disabled || isBusy}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingRole(null)}
                      disabled={disabled || isBusy}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span>{role}</span>
                  <div className="role-actions">
                    <button
                      type="button"
                      onClick={() => handleEditRole(role)}
                      disabled={disabled || isBusy}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(role)}
                      disabled={disabled || isBusy}
                    >
                      Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {settings.roles.length === 0 ? (
            <p className="muted">No roles yet. Add the first role above.</p>
          ) : null}
        </div>
      </details>
    </section>
  );
};

export default AdminSettings;
