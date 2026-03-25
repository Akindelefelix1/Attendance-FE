import type { Organization } from "../types";

type Props = {
  organizations: Organization[];
  variant?: "panel" | "card";
};

const AdminDashboard = ({ organizations, variant = "panel" }: Props) => {
  const totalStaff = organizations.reduce((sum, org) => sum + org.staff.length, 0);
  const totalOrgs = organizations.length;
  const totalCities = new Set(organizations.map((org) => org.location)).size;
  const isCard = variant === "card";

  return (
    <section
      className={
        isCard ? "summary-card admin-dashboard-card" : "panel dashboard admin-dashboard"
      }
    >
      <div className={isCard ? "summary-header" : "panel-header"}>
        <h2>Admin dashboard</h2>
        <p className="muted">Overview for organizations, staff, and attendance rules.</p>
      </div>
      <div className="dashboard-grid">
        <div className="stat-card">
          <span className="stat-label">Organizations</span>
          <strong className="stat-value">{totalOrgs}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total staff</span>
          <strong className="stat-value">{totalStaff}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Locations</span>
          <strong className="stat-value">{totalCities}</strong>
        </div>
      </div>
      {isCard ? null : (
        <div className="org-cards">
          {organizations.map((org) => (
            <div className="org-card" key={org.id}>
              <div>
                <h3>{org.name}</h3>
                <p className="muted">{org.location}</p>
              </div>
              <div className="org-meta">
                <span>{org.staff.length} staff</span>
                <span>Late after {org.settings.lateAfterTime}</span>
                <span>Early before {org.settings.earlyCheckoutBeforeTime}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default AdminDashboard;
