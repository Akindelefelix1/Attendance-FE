import type {
  AnalyticsResponse,
  AttendanceRecord,
  OrgSettings,
  Organization,
  StaffMember
} from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type ApiOrganization = {
  id: string;
  name: string;
  location: string;
  lateAfterTime: string;
  earlyCheckoutBeforeTime: string;
  officeGeoFenceEnabled?: boolean;
  officeLatitude?: number | null;
  officeLongitude?: number | null;
  officeRadiusMeters?: number | null;
  roles: string[];
  workingDays: number[];
  analyticsIncludeFutureDays: boolean;
  attendanceEditPolicy: "any" | "self_only";
  adminEmails: string[];
  planTier: "free" | "plus" | "pro";
  staff?: StaffMember[];
};

const toFrontendPolicy = (value: "any" | "self_only"): OrgSettings["attendanceEditPolicy"] =>
  value === "self_only" ? "self-only" : "any";

const toApiPolicy = (value: OrgSettings["attendanceEditPolicy"]) =>
  value === "self-only" ? "self_only" : "any";

const mapOrganization = (org: ApiOrganization): Organization => ({
  id: org.id,
  name: org.name,
  location: org.location,
  staff: org.staff ?? [],
  settings: {
    lateAfterTime: org.lateAfterTime,
    earlyCheckoutBeforeTime: org.earlyCheckoutBeforeTime,
    officeGeoFenceEnabled: org.officeGeoFenceEnabled ?? false,
    officeLatitude: org.officeLatitude ?? null,
    officeLongitude: org.officeLongitude ?? null,
    officeRadiusMeters: org.officeRadiusMeters ?? 150,
    roles: org.roles ?? [],
    workingDays: org.workingDays ?? [1, 2, 3, 4, 5],
    analyticsIncludeFutureDays: org.analyticsIncludeFutureDays ?? false,
    attendanceEditPolicy: toFrontendPolicy(org.attendanceEditPolicy ?? "any"),
    adminEmails: org.adminEmails ?? [],
    planTier: org.planTier ?? "free"
  }
});

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    },
    credentials: "include",
    ...options
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const listOrganizations = async (): Promise<Organization[]> => {
  const orgs = await request<ApiOrganization[]>("/organizations");
  return orgs.map(mapOrganization);
};

export const getOrganization = async (id: string): Promise<Organization> => {
  const org = await request<ApiOrganization>(`/organizations/${id}`);
  return mapOrganization(org);
};

export const createOrganization = async (payload: {
  name: string;
  location: string;
  settings?: Partial<OrgSettings>;
}): Promise<Organization> => {
  const body = {
    name: payload.name,
    location: payload.location,
    lateAfterTime: payload.settings?.lateAfterTime,
    earlyCheckoutBeforeTime: payload.settings?.earlyCheckoutBeforeTime,
    officeGeoFenceEnabled: payload.settings?.officeGeoFenceEnabled,
    officeLatitude: payload.settings?.officeLatitude,
    officeLongitude: payload.settings?.officeLongitude,
    officeRadiusMeters: payload.settings?.officeRadiusMeters,
    roles: payload.settings?.roles,
    workingDays: payload.settings?.workingDays,
    analyticsIncludeFutureDays: payload.settings?.analyticsIncludeFutureDays,
    attendanceEditPolicy: payload.settings
      ? toApiPolicy(payload.settings.attendanceEditPolicy ?? "any")
      : undefined,
    adminEmails: payload.settings?.adminEmails,
    planTier: payload.settings?.planTier
  };
  const org = await request<ApiOrganization>("/organizations", {
    method: "POST",
    body: JSON.stringify(body)
  });
  return mapOrganization(org);
};

export const updateOrganization = async (
  id: string,
  updates: Partial<Pick<Organization, "name" | "location">>
): Promise<Organization> => {
  const org = await request<ApiOrganization>(`/organizations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates)
  });
  return mapOrganization(org);
};

export const deleteOrganization = (id: string) =>
  request(`/organizations/${id}`, { method: "DELETE" });

export const updateSettings = async (
  orgId: string,
  settings: OrgSettings
): Promise<OrgSettings> => {
  const updated = await request<ApiOrganization>(`/settings/${orgId}`, {
    method: "PATCH",
    body: JSON.stringify({
      lateAfterTime: settings.lateAfterTime,
      earlyCheckoutBeforeTime: settings.earlyCheckoutBeforeTime,
      officeGeoFenceEnabled: settings.officeGeoFenceEnabled,
      officeLatitude: settings.officeLatitude,
      officeLongitude: settings.officeLongitude,
      officeRadiusMeters: settings.officeRadiusMeters,
      roles: settings.roles,
      workingDays: settings.workingDays,
      analyticsIncludeFutureDays: settings.analyticsIncludeFutureDays,
      attendanceEditPolicy: toApiPolicy(settings.attendanceEditPolicy),
      adminEmails: settings.adminEmails,
      planTier: settings.planTier
    })
  });
  return mapOrganization(updated).settings;
};

export const setOrganizationStaffPassword = (payload: {
  orgId: string;
  password: string;
}) =>
  request(`/settings/${payload.orgId}`, {
    method: "PATCH",
    body: JSON.stringify({
      staffLoginPassword: payload.password
    })
  });

export const listStaff = (organizationId: string) =>
  request<StaffMember[]>(`/staff/organization/${organizationId}`);

export const addStaff = (payload: {
  organizationId: string;
  fullName: string;
  role: string;
  email: string;
}) =>
  request<StaffMember>("/staff", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const listAttendanceForDate = (organizationId: string, dateISO: string) =>
  request<AttendanceRecord[]>(
    `/attendance?orgId=${encodeURIComponent(organizationId)}&dateISO=${encodeURIComponent(
      dateISO
    )}`
  );

export const listAttendanceForOrg = (organizationId: string) =>
  request<AttendanceRecord[]>(`/attendance/organization/${organizationId}`);

export const signInStaff = (payload: {
  organizationId: string;
  staffId: string;
  dateISO: string;
  latitude?: number;
  longitude?: number;
}) =>
  request<AttendanceRecord | null>("/attendance/sign-in", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const signOutStaff = (payload: {
  organizationId: string;
  staffId: string;
  dateISO: string;
  latitude?: number;
  longitude?: number;
}) =>
  request<AttendanceRecord | null>("/attendance/sign-out", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const loginAdmin = (payload: { email: string; password: string }) =>
  request<{ admin: { id: string; email: string; orgId: string } }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const loginStaff = (payload: { email: string; password: string }) =>
  request<{ staff: { id: string; email: string; orgId: string } }>(
    "/auth/staff/login",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );

export const registerAdmin = (payload: {
  orgId: string;
  email: string;
  password: string;
}) =>
  request<{ admin: { id: string; email: string; orgId: string } }>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );

export const logoutAdmin = () => request("/auth/logout", { method: "POST" });

export const requestStaffVerify = (payload: { email: string }) =>
  request<{ ok: boolean; token?: string }>("/auth/staff/request-verify", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const verifyStaff = (payload: { token: string }) =>
  request<{ ok: boolean }>("/auth/staff/verify", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const requestStaffReset = (payload: { email: string }) =>
  request<{ ok: boolean; token?: string }>("/auth/staff/request-reset", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const resetStaffPassword = (payload: { token: string; password: string }) =>
  request<{ ok: boolean }>("/auth/staff/reset", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const getMe = () =>
  request<{ user?: { id: string; orgId: string; email: string; role: string } }>(
    "/auth/me"
  );

export const getAnalytics = (payload: {
  orgId: string;
  range: "week" | "month";
  filter: "all" | "late" | "early" | "absent";
}) =>
  request<AnalyticsResponse>(
    `/analytics?orgId=${encodeURIComponent(payload.orgId)}&range=${payload.range}&filter=${payload.filter}`
  );
