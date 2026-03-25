import type { AttendanceRecord, OrgSettings, StaffMember } from "../types";
import { formatTime, isEarlyCheckout, isLateCheckIn } from "../lib/time";

const getRecord = (attendance: AttendanceRecord[], staffId: string) =>
  attendance.find((record) => record.staffId === staffId);

const getStatus = (record?: AttendanceRecord) => {
  if (!record?.signInAt) return "Not signed";
  if (record.signOutAt) return "Signed out";
  return "Signed in";
};

type Props = {
  staff: StaffMember[];
  attendance: AttendanceRecord[];
  settings: OrgSettings;
  onSignIn: (staffId: string) => void;
  onSignOut: (staffId: string) => void;
  canEdit: boolean;
  canEditStaff?: (staff: StaffMember) => boolean;
  isBusy?: boolean;
};

const AttendanceTable = ({
  staff,
  attendance,
  settings,
  onSignIn,
  onSignOut,
  canEdit,
  canEditStaff,
  isBusy = false
}: Props) => {
  if (staff.length === 0) {
    return (
      <div className="empty-state">
        <h3>No staff yet</h3>
        <p>Use the onboarding form to add staff to this organization.</p>
      </div>
    );
  }

  return (
    <div className="attendance-view">
      <div className="attendance-head">
        <span>Staff</span>
        <span>Role</span>
        <span>Sign in</span>
        <span>Sign out</span>
        <span>Status</span>
        <span>Flags</span>
        <span>Actions</span>
      </div>
      <div className="attendance-list">
        {staff.map((person) => {
          const record = getRecord(attendance, person.id);
          const status = getStatus(record);
          const isSignedIn = status === "Signed in";
          const isSignedOut = status === "Signed out";
          const canEditRow = canEdit && (canEditStaff ? canEditStaff(person) : true);
          const isLate = isLateCheckIn(
            record?.signInAt,
            settings.lateAfterTime,
            record?.dateISO
          );
          const isEarly = isEarlyCheckout(
            record?.signOutAt,
            settings.earlyCheckoutBeforeTime,
            record?.dateISO
          );

          return (
            <div className="attendance-row" key={person.id}>
              <div className="cell staff">
                <div className="staff-cell">
                  <span className="avatar">{person.fullName[0]}</span>
                  <div>
                    <strong>{person.fullName}</strong>
                    <span className="muted">{person.email}</span>
                  </div>
                </div>
              </div>
              <div className="cell" data-label="Role">
                {person.role}
              </div>
              <div className="cell" data-label="Sign in">
                {formatTime(record?.signInAt)}
              </div>
              <div className="cell" data-label="Sign out">
                {formatTime(record?.signOutAt)}
              </div>
              <div className="cell" data-label="Status">
                <span className={`status ${status.toLowerCase().replace(" ", "-")}`}>
                  {status}
                </span>
              </div>
              <div className="cell" data-label="Flags">
                <div className="flag-row">
                  {isLate ? <span className="flag late">Late</span> : null}
                  {isEarly ? <span className="flag early">Left early</span> : null}
                  {!isLate && !isEarly ? <span className="muted">—</span> : null}
                </div>
              </div>
              <div className="cell" data-label="Actions">
                <div className="action-row">
                  {!isSignedIn && !isSignedOut ? (
                    <button
                      className="btn ghost"
                      onClick={() => (canEditRow ? onSignIn(person.id) : null)}
                      disabled={!canEditRow || isBusy}
                    >
                      Sign in
                    </button>
                  ) : null}
                  {isSignedIn && !isSignedOut ? (
                    <button
                      className="btn solid"
                      onClick={() => (canEditRow ? onSignOut(person.id) : null)}
                      disabled={!canEditRow || isBusy}
                    >
                      Sign out
                    </button>
                  ) : null}
                  {isSignedOut ? <span className="muted">Completed</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttendanceTable;
