import type {
  AnalyticsResponse,
  AttendanceRecord,
  DisposableAttendance,
  DisposableAttendanceResponse,
  DisposableField,
  DisposableResponsesTable,
  PublicDisposableAttendanceForm,
  PublicHoliday,
  OrgSettings,
  Organization,
  StaffMember
} from "../types";

const envApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_URL = envApiUrl && envApiUrl.length > 0
  ? envApiUrl
  : import.meta.env.DEV
    ? "http://localhost:3000"
    : "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const parseErrorMessage = (raw: string, fallback: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  try {
    const parsed = JSON.parse(trimmed) as
      | { message?: string | string[] }
      | Array<{ message?: string | string[] }>;

    if (Array.isArray(parsed)) {
      const first = parsed[0]?.message;
      if (Array.isArray(first)) return first.join(", ");
      if (typeof first === "string" && first.trim().length > 0) return first;
      return fallback;
    }

    const message = parsed.message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string" && message.trim().length > 0) return message;
    return fallback;
  } catch {
    if (trimmed.length > 0) return trimmed;
    return fallback;
  }
};

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
    const fallback = `Request failed: ${response.status}`;
    throw new ApiError(parseErrorMessage(text, fallback), response.status);
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
  request<{
    admin: { id: string; email: string; orgId: string };
    verificationRequired?: boolean;
    message?: string;
    verificationToken?: string;
  }>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );

export const requestAdminVerify = (payload: { email: string }) =>
  request<{ ok: boolean; verificationToken?: string }>("/auth/admin/request-verify", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const verifyAdmin = (payload: { token: string }) =>
  request<{ ok: boolean; admin: { id: string; email: string; orgId: string } }>(
    "/auth/admin/verify",
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

export const requestAdminReset = (payload: { email: string }) =>
  request<{ ok: boolean; token?: string }>("/auth/admin/request-reset", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const resetAdminPassword = (payload: { token: string; password: string }) =>
  request<{ ok: boolean }>("/auth/admin/reset", {
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

export const listDisposableAttendances = async (orgId: string) =>
  request<DisposableAttendance[]>(`/disposable-attendance?orgId=${encodeURIComponent(orgId)}`);

export const createDisposableAttendance = async (payload: {
  orgId: string;
  title: string;
  description?: string;
  location?: string;
  eventDateISO: string;
  fields: DisposableField[];
  isRecurring: boolean;
  recurrenceMode: DisposableAttendance["recurrenceMode"];
  recurrenceEndDateISO: string | null;
  recurrenceCustomRule: string;
}) =>
  request<DisposableAttendance>("/disposable-attendance", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const updateDisposableAttendance = async (
  attendanceId: string,
  orgId: string,
  updates: Partial<DisposableAttendance>
) =>
  request<DisposableAttendance>(`/disposable-attendance/${attendanceId}`, {
    method: "PATCH",
    body: JSON.stringify({ ...updates, orgId })
  });

export const deleteDisposableAttendance = async (attendanceId: string, orgId: string) =>
  request(`/disposable-attendance/${attendanceId}?orgId=${encodeURIComponent(orgId)}`, {
    method: "DELETE"
  });

export const getDisposableAttendanceResponsesTable = async (attendanceId: string, orgId: string) =>
  request<DisposableResponsesTable>(
    `/disposable-attendance/${attendanceId}/responses-table?orgId=${encodeURIComponent(orgId)}`
  );

export const updateDisposableAttendanceFields = async (
  attendanceId: string,
  orgId: string,
  fields: DisposableField[]
) =>
  request<DisposableAttendance>(`/disposable-attendance/${attendanceId}/fields`, {
    method: "PATCH",
    body: JSON.stringify({ orgId, fields })
  });

export const submitDisposableAttendanceResponse = async (payload: {
  attendanceId: string;
  orgId: string;
  values: Record<string, string>;
}) =>
  request<DisposableAttendanceResponse>(
    `/disposable-attendance/${payload.attendanceId}/responses/admin`,
    {
      method: "POST",
      body: JSON.stringify({ orgId: payload.orgId, values: payload.values })
    }
  );

export const getPublicDisposableAttendanceForm = (publicId: string) =>
  request<PublicDisposableAttendanceForm>(
    `/public/disposable-attendance/${encodeURIComponent(publicId)}`,
    { credentials: "omit" }
  );

export const submitPublicDisposableAttendanceResponse = (payload: {
  publicId: string;
  values: Record<string, string>;
}) =>
  request<DisposableAttendanceResponse>(
    `/public/disposable-attendance/${encodeURIComponent(payload.publicId)}/check-in`,
    {
      method: "POST",
      body: JSON.stringify({ values: payload.values }),
      credentials: "omit"
    }
  );

export const listPublicHolidays = (orgId: string): Promise<PublicHoliday[]> =>
  request<PublicHoliday[]>(`/organizations/${orgId}/public-holidays`);

export const createPublicHoliday = (
  orgId: string,
  payload: Omit<PublicHoliday, "id" | "organizationId" | "createdAt" | "updatedAt">
): Promise<PublicHoliday> =>
  request<PublicHoliday>(`/organizations/${orgId}/public-holidays`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const updatePublicHoliday = (
  orgId: string,
  id: string,
  payload: Partial<PublicHoliday>
): Promise<PublicHoliday> =>
  request<PublicHoliday>(`/organizations/${orgId}/public-holidays/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export const deletePublicHoliday = (orgId: string, id: string): Promise<void> =>
  request(`/organizations/${orgId}/public-holidays/${id}`, {
    method: "DELETE"
  });
