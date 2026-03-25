export type AttendanceStatus = "not-signed" | "signed-in" | "signed-out";

export type StaffMember = {
  id: string;
  fullName: string;
  role: string;
  email: string;
};

export type OrgSettings = {
  lateAfterTime: string;
  earlyCheckoutBeforeTime: string;
  officeGeoFenceEnabled: boolean;
  officeLatitude: number | null;
  officeLongitude: number | null;
  officeRadiusMeters: number;
  roles: string[];
  workingDays: number[];
  analyticsIncludeFutureDays: boolean;
  attendanceEditPolicy: "any" | "self-only";
  adminEmails: string[];
  planTier: "free" | "plus" | "pro";
};

export type Organization = {
  id: string;
  name: string;
  location: string;
  staff: StaffMember[];
  settings: OrgSettings;
};

export type AttendanceRecord = {
  staffId: string;
  dateISO: string;
  signInAt?: string;
  signOutAt?: string;
};

export type AnalyticsRow = {
  staff: StaffMember;
  lateCount: number;
  earlyCount: number;
  absentCount: number;
};

export type PunctualityTrend = {
  dateISO: string;
  onTime: number;
  late: number;
  earlyCheckout: number;
  absent: number;
  attendanceRate: number;
  punctualityRate: number;
  avgLateMinutes: number;
  avgEarlyCheckoutMinutes: number;
};

export type ReliabilityStaffRow = {
  staff: StaffMember;
  expectedDays: number;
  presentDays: number;
  attendanceRate: number;
  punctualityRate: number;
  maxAttendanceStreak: number;
  maxAbsenceStreak: number;
  avgLateMinutes: number;
  avgEarlyCheckoutMinutes: number;
  policyBreaches: number;
};

export type ReliabilitySummary = {
  expectedDays: number;
  averageAttendanceRate: number;
  averagePunctualityRate: number;
  averageLateMinutes: number;
  averageEarlyCheckoutMinutes: number;
  staff: ReliabilityStaffRow[];
};

export type RoleInsight = {
  role: string;
  staffCount: number;
  lateCount: number;
  earlyCount: number;
  absentCount: number;
  expectedDays: number;
  presentDays: number;
  onTimeDays: number;
  attendanceRate: number;
  punctualityRate: number;
  policyBreaches: number;
};

export type GeoPolicyCompliance = {
  geoFenceEnabled: boolean;
  geoFenceConfigured: boolean;
  officeRadiusMeters: number | null;
  attendanceEditPolicy: "any" | "self_only";
  analyticsIncludeFutureDays: boolean;
  expectedCheckIns: number;
  actualCheckIns: number;
  missingCheckIns: number;
  policyBreachEvents: number;
  complianceRate: number;
};

export type AnalyticsResponse = {
  rangeStart: string | null;
  rangeEnd: string | null;
  rows: AnalyticsRow[];
  totals: { late: number; early: number; absent: number };
  punctualityTrends: PunctualityTrend[];
  reliability: ReliabilitySummary;
  roleInsights: RoleInsight[];
  geoPolicyCompliance: GeoPolicyCompliance;
};
