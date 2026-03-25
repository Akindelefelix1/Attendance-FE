import type { AttendanceRecord, Organization } from "../types";

type Props = {
  organizations: Organization[];
  selectedOrgId: string;
  attendanceForDate: AttendanceRecord[];
  variant?: "panel" | "card";
};

const StaffDashboard = ({
  organizations,
  selectedOrgId,
  attendanceForDate,
  variant = "panel"
}: Props) => {
  const org = organizations.find((item) => item.id === selectedOrgId);
  const totalStaff = org?.staff.length ?? 0;
  const checkedIn = attendanceForDate.length;
  const signedOut = attendanceForDate.filter((record) => record.signOutAt).length;
  const isCard = variant === "card";

  return (
    <section
      className={
        isCard
          ? "summary-card staff-dashboard-card"
          : "panel dashboard staff-dashboard"
      }
    >
      <div className={isCard ? "summary-header" : "panel-header"}>
        <h2>Staff dashboard</h2>
        <p className="muted">Quick status for your organization today.</p>
      </div>
      <div className="dashboard-grid">
        <div className="stat-card">
          <span className="stat-label">Staff total</span>
          <strong className="stat-value">{totalStaff}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Checked in</span>
          <strong className="stat-value">{checkedIn}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Checked out</span>
          <strong className="stat-value">{signedOut}</strong>
        </div>
      </div>
    </section>
  );
};

export default StaffDashboard;
