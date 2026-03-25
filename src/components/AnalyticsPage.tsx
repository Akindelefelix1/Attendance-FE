import { useEffect, useState } from "react";
import type {
  GeoPolicyCompliance,
  Organization,
  PunctualityTrend,
  ReliabilityStaffRow,
  RoleInsight,
  StaffMember
} from "../types";
import { formatDateLong } from "../lib/time";
import { getAnalytics } from "../lib/api";

type Props = {
  organization: Organization | null;
};

type RangeKey = "week" | "month";
type FilterKey = "all" | "late" | "early" | "absent";

const toPercentLabel = (value: number) => `${value.toFixed(1)}%`;

const emptyGeoCompliance: GeoPolicyCompliance = {
  geoFenceEnabled: false,
  geoFenceConfigured: false,
  officeRadiusMeters: null,
  attendanceEditPolicy: "any",
  analyticsIncludeFutureDays: false,
  expectedCheckIns: 0,
  actualCheckIns: 0,
  missingCheckIns: 0,
  policyBreachEvents: 0,
  complianceRate: 0
};

const downloadCsv = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const AnalyticsPage = ({ organization }: Props) => {
  const MONTHLY_TRENDS_PAGE_SIZE = 7;
  const [range, setRange] = useState<RangeKey>("week");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [rows, setRows] = useState<
    Array<{ staff: StaffMember; lateCount: number; earlyCount: number; absentCount: number }>
  >([]);
  const [totals, setTotals] = useState({ late: 0, early: 0, absent: 0 });
  const [punctualityTrends, setPunctualityTrends] = useState<PunctualityTrend[]>([]);
  const [reliabilityStaff, setReliabilityStaff] = useState<ReliabilityStaffRow[]>([]);
  const [reliabilitySummary, setReliabilitySummary] = useState({
    expectedDays: 0,
    averageAttendanceRate: 0,
    averagePunctualityRate: 0,
    averageLateMinutes: 0,
    averageEarlyCheckoutMinutes: 0
  });
  const [roleInsights, setRoleInsights] = useState<RoleInsight[]>([]);
  const [geoPolicyCompliance, setGeoPolicyCompliance] =
    useState<GeoPolicyCompliance>(emptyGeoCompliance);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleTrendCount, setVisibleTrendCount] = useState(MONTHLY_TRENDS_PAGE_SIZE);

  useEffect(() => {
    setVisibleTrendCount(MONTHLY_TRENDS_PAGE_SIZE);
  }, [range, organization?.id]);

  useEffect(() => {
    if (!organization) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const result = await getAnalytics({
          orgId: organization.id,
          range,
          filter
        });
        setRows(result.rows);
        setTotals(result.totals);
        setPunctualityTrends(result.punctualityTrends);
        setReliabilitySummary({
          expectedDays: result.reliability.expectedDays,
          averageAttendanceRate: result.reliability.averageAttendanceRate,
          averagePunctualityRate: result.reliability.averagePunctualityRate,
          averageLateMinutes: result.reliability.averageLateMinutes,
          averageEarlyCheckoutMinutes: result.reliability.averageEarlyCheckoutMinutes
        });
        setReliabilityStaff(result.reliability.staff);
        setRoleInsights(result.roleInsights);
        setGeoPolicyCompliance(result.geoPolicyCompliance);
        setRangeStart(result.rangeStart);
        setRangeEnd(result.rangeEnd);
      } catch {
        setRows([]);
        setTotals({ late: 0, early: 0, absent: 0 });
        setPunctualityTrends([]);
        setReliabilitySummary({
          expectedDays: 0,
          averageAttendanceRate: 0,
          averagePunctualityRate: 0,
          averageLateMinutes: 0,
          averageEarlyCheckoutMinutes: 0
        });
        setReliabilityStaff([]);
        setRoleInsights([]);
        setGeoPolicyCompliance(emptyGeoCompliance);
        setRangeStart(null);
        setRangeEnd(null);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [organization, range, filter]);

  const handleExportCsv = () => {
    if (!organization || rows.length === 0) return;
    const headers = ["Staff Name", "Email", "Role", "Late", "Early", "Absent"];
    const csvRows = rows.map((row) => [
      row.staff.fullName,
      row.staff.email,
      row.staff.role,
      row.lateCount,
      row.earlyCount,
      row.absentCount
    ]);
    const csv = [headers, ...csvRows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const startLabel = rangeStart ?? "range";
    const endLabel = rangeEnd ?? "range";
    const filename = `${organization.name
      .toLowerCase()
      .replace(/\s+/g, "-")}-analytics-${startLabel}-to-${endLabel}.csv`;
    downloadCsv(filename, csv);
  };

  const rangeLabel =
    rangeStart && rangeEnd
      ? `Highlights for ${formatDateLong(rangeStart)} to ${formatDateLong(rangeEnd)}.`
      : "No working days available for the selected range.";

  const shownPunctualityTrends =
    range === "month"
      ? punctualityTrends.slice(0, visibleTrendCount)
      : punctualityTrends;

  const canViewMoreMonthlyTrends =
    range === "month" && visibleTrendCount < punctualityTrends.length;
  const canViewLessMonthlyTrends =
    range === "month" && visibleTrendCount > MONTHLY_TRENDS_PAGE_SIZE;

  if (!organization) {
    return (
      <section className="panel analytics-page">
        <div className="panel-header">
          <h2>Analytics</h2>
          <p className="muted">Select an organization to view analytics.</p>
        </div>
      </section>
    );
  }

  if (organization.staff.length === 0) {
    return (
      <section className="panel analytics-page">
        <div className="panel-header">
          <h2>Analytics</h2>
          <p className="muted">No staff yet. Add team members to see analytics.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel analytics-page">
      <div className="analytics-hero">
        <div>
          <h2>{organization.name} analytics</h2>
          <p className="muted">{rangeLabel}</p>
        </div>
        <div className="analytics-range">
          <button
            className={`btn ${range === "week" ? "solid" : "ghost"}`}
            type="button"
            onClick={() => setRange("week")}
          >
            This week
          </button>
          <button
            className={`btn ${range === "month" ? "solid" : "ghost"}`}
            type="button"
            onClick={() => setRange("month")}
          >
            This month
          </button>
          <button className="btn ghost" type="button" onClick={handleExportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="analytics-stats">
        <div className="stat-card">
          <span className="stat-label">Late arrivals</span>
          <strong className="stat-value">{totals.late}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Early checkouts</span>
          <strong className="stat-value">{totals.early}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Absences</span>
          <strong className="stat-value">{totals.absent}</strong>
        </div>
      </div>

      <div className="analytics-filters">
        <button
          className={`filter-pill ${filter === "all" ? "active" : ""}`}
          type="button"
          onClick={() => setFilter("all")}
        >
          All staff
        </button>
        <button
          className={`filter-pill ${filter === "late" ? "active" : ""}`}
          type="button"
          onClick={() => setFilter("late")}
        >
          Late
        </button>
        <button
          className={`filter-pill ${filter === "early" ? "active" : ""}`}
          type="button"
          onClick={() => setFilter("early")}
        >
          Left early
        </button>
        <button
          className={`filter-pill ${filter === "absent" ? "active" : ""}`}
          type="button"
          onClick={() => setFilter("absent")}
        >
          Absent
        </button>
      </div>

      <div className="analytics-table">
        <div className="analytics-head">
          <span>Staff</span>
          <span>Role</span>
          <span>Late</span>
          <span>Early</span>
          <span>Absent</span>
        </div>
        {isLoading ? (
          <div className="empty-state">
            <h3>Loading analytics</h3>
            <p className="muted">Fetching latest attendance highlights.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <h3>No results</h3>
            <p className="muted">No staff match this filter for the selected range.</p>
          </div>
        ) : (
          rows.map((row) => (
            <div className="analytics-row" key={row.staff.id}>
              <div className="cell staff">
                <div className="staff-cell">
                  <span className="avatar">{row.staff.fullName[0]}</span>
                  <div>
                    <strong>{row.staff.fullName}</strong>
                    <span className="muted">{row.staff.email}</span>
                  </div>
                </div>
              </div>
              <div className="cell" data-label="Role">
                {row.staff.role}
              </div>
              <div className="cell" data-label="Late">
                <span className="metric-pill late">{row.lateCount}</span>
              </div>
              <div className="cell" data-label="Early">
                <span className="metric-pill early">{row.earlyCount}</span>
              </div>
              <div className="cell" data-label="Absent">
                <span className="metric-pill absent">{row.absentCount}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="analytics-section">
        <div className="section-header-row">
          <h3>Punctuality trends</h3>
          <span className="muted">Daily trendline for on-time behavior</span>
        </div>
        <div className="trend-grid">
          {punctualityTrends.length === 0 ? (
            <div className="empty-state compact">
              <p className="muted">No punctuality trend data available for this range.</p>
            </div>
          ) : (
            shownPunctualityTrends.map((trend) => (
              <article key={trend.dateISO} className="trend-card">
                <strong>{formatDateLong(trend.dateISO)}</strong>
                <div className="trend-card-grid">
                  <span>On-time: {trend.onTime}</span>
                  <span>Late: {trend.late}</span>
                  <span>Early out: {trend.earlyCheckout}</span>
                  <span>Absent: {trend.absent}</span>
                </div>
                <div className="trend-badges">
                  <span className="metric-pill neutral">
                    Attendance {toPercentLabel(trend.attendanceRate)}
                  </span>
                  <span className="metric-pill sea">
                    Punctuality {toPercentLabel(trend.punctualityRate)}
                  </span>
                </div>
                <p className="muted trend-meta">
                  Avg late {trend.avgLateMinutes}m • Avg early-out {trend.avgEarlyCheckoutMinutes}m
                </p>
              </article>
            ))
          )}
        </div>
        {canViewMoreMonthlyTrends || canViewLessMonthlyTrends ? (
          <div className="trend-actions">
            {canViewLessMonthlyTrends ? (
              <button
                className="btn ghost"
                type="button"
                onClick={() => setVisibleTrendCount(MONTHLY_TRENDS_PAGE_SIZE)}
              >
                View less
              </button>
            ) : null}
            {canViewMoreMonthlyTrends ? (
              <button
                className="btn ghost"
                type="button"
                onClick={() =>
                  setVisibleTrendCount((current) => current + MONTHLY_TRENDS_PAGE_SIZE)
                }
              >
                View more
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="analytics-section">
        <div className="section-header-row">
          <h3>Attendance reliability</h3>
          <span className="muted">Consistency and streak-based reliability signals</span>
        </div>
        <div className="analytics-stats">
          <div className="stat-card">
            <span className="stat-label">Expected days / staff</span>
            <strong className="stat-value">{reliabilitySummary.expectedDays}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Avg attendance rate</span>
            <strong className="stat-value">
              {toPercentLabel(reliabilitySummary.averageAttendanceRate)}
            </strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Avg punctuality rate</span>
            <strong className="stat-value">
              {toPercentLabel(reliabilitySummary.averagePunctualityRate)}
            </strong>
          </div>
        </div>
        <div className="analytics-table compact-table">
          <div className="analytics-head reliability-head">
            <span>Staff</span>
            <span>Attendance</span>
            <span>Punctuality</span>
            <span>Best streak</span>
            <span>Absence streak</span>
            <span>Breaches</span>
          </div>
          {reliabilityStaff.map((row) => (
            <div className="analytics-row reliability-row" key={row.staff.id}>
              <div className="cell staff">
                <div className="staff-cell">
                  <span className="avatar">{row.staff.fullName[0]}</span>
                  <div>
                    <strong>{row.staff.fullName}</strong>
                    <span className="muted">{row.staff.email}</span>
                  </div>
                </div>
              </div>
              <div className="cell" data-label="Attendance">
                {toPercentLabel(row.attendanceRate)}
              </div>
              <div className="cell" data-label="Punctuality">
                {toPercentLabel(row.punctualityRate)}
              </div>
              <div className="cell" data-label="Best streak">
                {row.maxAttendanceStreak}
              </div>
              <div className="cell" data-label="Absence streak">
                {row.maxAbsenceStreak}
              </div>
              <div className="cell" data-label="Breaches">
                <span className="metric-pill absent">{row.policyBreaches}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="analytics-section">
        <div className="section-header-row">
          <h3>Team/Role insights</h3>
          <span className="muted">Role-level reliability and policy trend comparisons</span>
        </div>
        <div className="analytics-table compact-table">
          <div className="analytics-head role-head">
            <span>Role</span>
            <span>Team size</span>
            <span>Attendance</span>
            <span>Punctuality</span>
            <span>Breaches</span>
          </div>
          {roleInsights.length === 0 ? (
            <div className="empty-state compact">
              <p className="muted">No role data available.</p>
            </div>
          ) : (
            roleInsights.map((role) => (
              <div className="analytics-row role-row" key={role.role}>
                <div className="cell" data-label="Role">
                  <strong>{role.role}</strong>
                </div>
                <div className="cell" data-label="Team size">
                  {role.staffCount}
                </div>
                <div className="cell" data-label="Attendance">
                  {toPercentLabel(role.attendanceRate)}
                </div>
                <div className="cell" data-label="Punctuality">
                  {toPercentLabel(role.punctualityRate)}
                </div>
                <div className="cell" data-label="Breaches">
                  <span className="metric-pill absent">{role.policyBreaches}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="analytics-section">
        <div className="section-header-row">
          <h3>Geo/Policy compliance</h3>
          <span className="muted">Configuration readiness and attendance policy adherence</span>
        </div>
        <div className="analytics-stats">
          <div className="stat-card">
            <span className="stat-label">Compliance rate</span>
            <strong className="stat-value">
              {toPercentLabel(geoPolicyCompliance.complianceRate)}
            </strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Geo-fence</span>
            <strong className="stat-value">
              {geoPolicyCompliance.geoFenceEnabled
                ? geoPolicyCompliance.geoFenceConfigured
                  ? "Enabled"
                  : "Needs setup"
                : "Disabled"}
            </strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Attendance edit policy</span>
            <strong className="stat-value">
              {geoPolicyCompliance.attendanceEditPolicy === "self_only"
                ? "Self only"
                : "Any"}
            </strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Policy breach events</span>
            <strong className="stat-value">{geoPolicyCompliance.policyBreachEvents}</strong>
          </div>
        </div>
        <div className="compliance-meta">
          <span className="metric-pill neutral">
            Check-ins {geoPolicyCompliance.actualCheckIns}/{geoPolicyCompliance.expectedCheckIns}
          </span>
          <span className="metric-pill early">
            Missing check-ins {geoPolicyCompliance.missingCheckIns}
          </span>
          <span className="metric-pill sea">
            Future days in analytics {geoPolicyCompliance.analyticsIncludeFutureDays ? "On" : "Off"}
          </span>
          {geoPolicyCompliance.officeRadiusMeters !== null ? (
            <span className="metric-pill neutral">
              Geo radius {geoPolicyCompliance.officeRadiusMeters}m
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default AnalyticsPage;
