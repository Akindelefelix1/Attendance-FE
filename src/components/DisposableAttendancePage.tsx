import { useEffect, useMemo, useState } from "react";
import type {
  DisposableAttendance,
  DisposableAttendanceResponse,
  DisposableField,
  Organization
} from "../types";
import {
  checkInDisposableAttendanceResponse,
  createDisposableAttendance,
  deleteDisposableAttendance,
  getDisposableAttendanceResponsesTable,
  listDisposableAttendances,
  submitDisposableAttendanceResponse,
  updateDisposableAttendanceFields,
  updateDisposableAttendance
} from "../lib/api";
import { formatDateLong, getTodayISO } from "../lib/time";
import ConfirmModal from "./ConfirmModal";
import SuccessModal from "./SuccessModal";

type Props = {
  organization: Organization | null;
};

type FieldToggleState = {
  email: boolean;
  phone: boolean;
  occupation: boolean;
  address: boolean;
};

const tierLimits: Record<Organization["settings"]["planTier"], number> = {
  free: 1,
  plus: 10,
  pro: 25
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

const toSlug = (value: string) => value.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const recurrenceLabel = (item: DisposableAttendance) => {
  if (!item.isRecurring || item.recurrenceMode === "none") return "One-time";
  if (item.recurrenceMode === "custom") {
    return item.recurrenceCustomRule
      ? `Custom: ${item.recurrenceCustomRule}`
      : "Custom recurrence";
  }
  const modeText = item.recurrenceMode[0].toUpperCase() + item.recurrenceMode.slice(1);
  if (item.recurrenceEndDateISO) {
    return `${modeText} until ${formatDateLong(item.recurrenceEndDateISO)}`;
  }
  return `${modeText} (no end date)`;
};

const fieldTypeToLabel = (type: DisposableField["type"]) => {
  if (type === "full-name") return "Full name";
  if (type === "email") return "Email";
  if (type === "phone") return "Phone number";
  if (type === "occupation") return "Occupation";
  if (type === "address") return "Address";
  return "Text";
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

type ToastState = {
  kind: "success" | "error";
  message: string;
};

type EditableCustomField = {
  id: string;
  label: string;
};

type ResponseFilter = "all" | "preregistered" | "checked-in";

const standardFieldIds = new Set(["full-name", "email", "phone", "occupation", "address"]);

const DisposableAttendancePage = ({ organization }: Props) => {
  const [items, setItems] = useState<DisposableAttendance[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [responses, setResponses] = useState<DisposableAttendanceResponse[]>([]);
  const [responseColumns, setResponseColumns] = useState<Array<{ key: string; label: string }>>([]);
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("all");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventDateISO, setEventDateISO] = useState(getTodayISO());
  const [collect, setCollect] = useState<FieldToggleState>({
    email: true,
    phone: false,
    occupation: false,
    address: false
  });
  const [customFieldInput, setCustomFieldInput] = useState("");
  const [customFields, setCustomFields] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceMode, setRecurrenceMode] = useState<DisposableAttendance["recurrenceMode"]>("none");
  const [recurrenceEndDateISO, setRecurrenceEndDateISO] = useState<string>("");
  const [recurrenceCustomRule, setRecurrenceCustomRule] = useState("");
  const [allowPreRegister, setAllowPreRegister] = useState(false);
  const [createError, setCreateError] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [responseValues, setResponseValues] = useState<Record<string, string>>({});
  const [responseError, setResponseError] = useState("");
  const [editCollect, setEditCollect] = useState<FieldToggleState>({
    email: true,
    phone: false,
    occupation: false,
    address: false
  });
  const [editCustomFieldInput, setEditCustomFieldInput] = useState("");
  const [editCustomFields, setEditCustomFields] = useState<EditableCustomField[]>([]);
  const [editFieldsError, setEditFieldsError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [manageError, setManageError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [isSavingFields, setIsSavingFields] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [successModalMessage, setSuccessModalMessage] = useState<string>("");
  const [pendingCheckInResponse, setPendingCheckInResponse] =
    useState<DisposableAttendanceResponse | null>(null);
  const [isCheckingInResponse, setIsCheckingInResponse] = useState(false);
  const [isRefreshingResponses, setIsRefreshingResponses] = useState(false);
  const [isPageFocused, setIsPageFocused] = useState(
    typeof document !== "undefined" ? document.hasFocus() && document.visibilityState === "visible" : true
  );

  const activeItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const responseSummary = useMemo(() => {
    let preRegistered = 0;
    let checkedIn = 0;

    for (const response of responses) {
      if (response.status === "checked-in") {
        checkedIn += 1;
      } else if (response.status === "preregistered") {
        preRegistered += 1;
      }
    }

    const total = responses.length;
    const attendanceRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    return {
      total,
      preRegistered,
      checkedIn,
      attendanceRate
    };
  }, [responses]);

  const filteredResponses = useMemo(() => {
    if (responseFilter === "all") return responses;
    return responses.filter((response) => response.status === responseFilter);
  }, [responses, responseFilter]);

  const planTier = organization?.settings.planTier ?? "free";
  const limit = tierLimits[planTier];

  const showToast = (kind: ToastState["kind"], message: string) => {
    setToast({ kind, message });
  };

  const showSuccessModal = (message: string) => {
    setSuccessModalMessage(message);
  };

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const reloadItems = async () => {
    if (!organization) {
      setItems([]);
      setSelectedId("");
      setLoadError("");
      return;
    }
    try {
      setLoadError("");
      const next = await listDisposableAttendances(organization.id);
      setItems(next);
      setSelectedId((prev) => {
        if (prev && next.some((item) => item.id === prev)) return prev;
        return next[0]?.id ?? "";
      });
    } catch (error) {
      setItems([]);
      setSelectedId("");
      const message = getErrorMessage(error, "Could not load disposable attendance.");
      setLoadError(message);
      showToast("error", message);
    }
  };

  const reloadResponses = async (attendanceId: string) => {
    if (!organization) {
      setResponses([]);
      setResponseColumns([]);
      return;
    }
    try {
      setManageError("");
      const table = await getDisposableAttendanceResponsesTable(attendanceId, organization.id);
      setResponseColumns(table.columns);
      setResponses(
        table.rows.map((row) => ({
          id: row.id,
          attendanceId,
          source: row.source,
          status: row.status,
          preRegisteredAtISO: row.preRegisteredAtISO,
          checkedInAtISO: row.checkedInAtISO,
          submittedAtISO: row.submittedAtISO,
          values: row.values
        }))
      );
    } catch (error) {
      setResponses([]);
      setResponseColumns([]);
      const message = getErrorMessage(error, "Could not load responses.");
      setManageError(message);
      showToast("error", message);
    }
  };

  useEffect(() => {
    void reloadItems();
  }, [organization?.id]);

  useEffect(() => {
    if (!selectedId) {
      setResponses([]);
      setResponseColumns([]);
      setResponseFilter("all");
      return;
    }
    void reloadResponses(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!activeItem?.allowPreRegister && responseFilter !== "all") {
      setResponseFilter("all");
    }
  }, [activeItem?.allowPreRegister, responseFilter]);

  useEffect(() => {
    if (!activeItem) {
      setResponseValues({});
      setEditCollect({
        email: true,
        phone: false,
        occupation: false,
        address: false
      });
      setEditCustomFields([]);
      setEditCustomFieldInput("");
      setEditFieldsError("");
      return;
    }
    const initial: Record<string, string> = {};
    activeItem.fields.forEach((field) => {
      initial[field.id] = "";
    });
    setResponseValues(initial);

    setEditCollect({
      email: activeItem.fields.some((field) => field.id === "email"),
      phone: activeItem.fields.some((field) => field.id === "phone"),
      occupation: activeItem.fields.some((field) => field.id === "occupation"),
      address: activeItem.fields.some((field) => field.id === "address")
    });
    setEditCustomFields(
      activeItem.fields
        .filter((field) => !standardFieldIds.has(field.id))
        .map((field) => ({ id: field.id, label: field.label }))
    );
    setEditCustomFieldInput("");
    setEditFieldsError("");
    setPendingCheckInResponse(null);
  }, [activeItem?.id]);

  useEffect(() => {
    const syncFocusState = () => {
      setIsPageFocused(document.hasFocus() && document.visibilityState === "visible");
    };

    window.addEventListener("focus", syncFocusState);
    window.addEventListener("blur", syncFocusState);
    document.addEventListener("visibilitychange", syncFocusState);
    syncFocusState();

    return () => {
      window.removeEventListener("focus", syncFocusState);
      window.removeEventListener("blur", syncFocusState);
      document.removeEventListener("visibilitychange", syncFocusState);
    };
  }, []);

  useEffect(() => {
    if (!activeItem || !isPageFocused) return;

    const intervalId = window.setInterval(() => {
      void reloadResponses(activeItem.id);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [activeItem?.id, isPageFocused, organization?.id]);

  const canCreate = items.length < limit;

  const publicLink = useMemo(() => {
    if (!activeItem) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const basePath = typeof window !== "undefined" ? window.location.pathname : "/";
    return `${origin}${basePath}#/public/disposable/${activeItem.publicId}`;
  }, [activeItem?.publicId]);

  const qrImageUrl = useMemo(() => {
    if (!publicLink) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicLink)}`;
  }, [publicLink]);

  const handleAddCustomField = () => {
    const trimmed = customFieldInput.trim();
    if (!trimmed) return;
    if (customFields.some((value) => value.toLowerCase() === trimmed.toLowerCase())) {
      setCustomFieldInput("");
      return;
    }
    setCustomFields((prev) => [...prev, trimmed]);
    setCustomFieldInput("");
  };

  const handleRemoveCreateCustomField = (label: string) => {
    setCustomFields((prev) => prev.filter((item) => item !== label));
  };

  const handleAddEditCustomField = () => {
    const trimmed = editCustomFieldInput.trim();
    if (!trimmed) return;
    if (editCustomFields.some((field) => field.label.toLowerCase() === trimmed.toLowerCase())) {
      setEditCustomFieldInput("");
      return;
    }
    setEditCustomFields((prev) => [
      ...prev,
      {
        id: `custom-${toSlug(trimmed)}-${Math.random().toString(36).slice(2, 6)}`,
        label: trimmed
      }
    ]);
    setEditCustomFieldInput("");
  };

  const handleRemoveEditCustomField = (fieldId: string) => {
    setEditCustomFields((prev) => prev.filter((field) => field.id !== fieldId));
  };

  const handleCreate = async () => {
    if (!organization) return;
    if (!canCreate) return;
    setCreateError("");
    setManageError("");
    if (!title.trim()) {
      setCreateError("Provide a title for this attendance.");
      return;
    }

    const fields: DisposableField[] = [
      { id: "full-name", label: "Full name", type: "full-name", required: true }
    ];

    if (collect.email) {
      fields.push({ id: "email", label: "Email", type: "email", required: true });
    }
    if (collect.phone) {
      fields.push({ id: "phone", label: "Phone number", type: "phone", required: true });
    }
    if (collect.occupation) {
      fields.push({ id: "occupation", label: "Occupation", type: "occupation", required: false });
    }
    if (collect.address) {
      fields.push({ id: "address", label: "Address", type: "address", required: false });
    }

    customFields.forEach((label) => {
      fields.push({
        id: `custom-${toSlug(label)}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        type: "text",
        required: false
      });
    });

    const normalizedRecurring = isRecurring ? recurrenceMode : "none";
    const normalizedEndDate =
      isRecurring && recurrenceMode !== "custom" && recurrenceEndDateISO
        ? recurrenceEndDateISO
        : null;

    try {
      setIsCreating(true);
      await createDisposableAttendance({
        orgId: organization.id,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        eventDateISO,
        fields,
        isRecurring,
        recurrenceMode: normalizedRecurring,
        recurrenceEndDateISO: normalizedEndDate,
        recurrenceCustomRule:
          isRecurring && recurrenceMode === "custom" ? recurrenceCustomRule.trim() : "",
        allowPreRegister
      });

      setTitle("");
      setDescription("");
      setLocation("");
      setEventDateISO(getTodayISO());
      setCollect({ email: true, phone: false, occupation: false, address: false });
      setCustomFields([]);
      setIsRecurring(false);
      setRecurrenceMode("none");
      setRecurrenceEndDateISO("");
      setRecurrenceCustomRule("");
      setAllowPreRegister(false);
      setIsCreateModalOpen(false);
      showSuccessModal("Disposable attendance created.");

      await reloadItems();
    } catch (error) {
      const message = getErrorMessage(error, "Could not create disposable attendance.");
      setCreateError(message);
      showToast("error", message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveCollectedDetails = async () => {
    if (!activeItem || !organization) return;
    setEditFieldsError("");

    const nextFields: DisposableField[] = [
      { id: "full-name", label: "Full name", type: "full-name", required: true }
    ];

    if (editCollect.email) {
      nextFields.push({ id: "email", label: "Email", type: "email", required: true });
    }
    if (editCollect.phone) {
      nextFields.push({ id: "phone", label: "Phone number", type: "phone", required: true });
    }
    if (editCollect.occupation) {
      nextFields.push({ id: "occupation", label: "Occupation", type: "occupation", required: false });
    }
    if (editCollect.address) {
      nextFields.push({ id: "address", label: "Address", type: "address", required: false });
    }

    editCustomFields.forEach((field) => {
      nextFields.push({
        id: field.id,
        label: field.label,
        type: "text",
        required: false
      });
    });

    try {
      setIsSavingFields(true);
      await updateDisposableAttendanceFields(activeItem.id, organization.id, nextFields);
      await reloadItems();
      await reloadResponses(activeItem.id);
      showSuccessModal("Details to collect updated.");
    } catch (error) {
      const message = getErrorMessage(error, "Could not update details to collect.");
      setEditFieldsError(message);
      showToast("error", message);
    } finally {
      setIsSavingFields(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!activeItem || !organization) return;
    setResponseError("");
    setManageError("");

    for (const field of activeItem.fields) {
      const value = responseValues[field.id]?.trim() ?? "";
      if (field.required && !value) {
        setResponseError(`Please fill ${field.label}.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await submitDisposableAttendanceResponse({
        attendanceId: activeItem.id,
        orgId: organization.id,
        values: Object.fromEntries(
          Object.entries(responseValues).map(([key, value]) => [key, value.trim()])
        )
      });

      const resetValues: Record<string, string> = {};
      activeItem.fields.forEach((field) => {
        resetValues[field.id] = "";
      });
      setResponseValues(resetValues);
      await reloadResponses(activeItem.id);
      showSuccessModal("Attendance response submitted.");
    } catch (error) {
      const message = getErrorMessage(error, "Could not submit attendance response.");
      setResponseError(message);
      showToast("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!activeItem || !organization) return;
    try {
      setIsManaging(true);
      setManageError("");
      await updateDisposableAttendance(activeItem.id, organization.id, {
        isArchived: !activeItem.isArchived
      });
      await reloadItems();
      showSuccessModal(activeItem.isArchived ? "Attendance reopened." : "Attendance archived.");
    } catch (error) {
      const message = getErrorMessage(error, "Could not update disposable attendance.");
      setManageError(message);
      showToast("error", message);
    } finally {
      setIsManaging(false);
    }
  };

  const handleDeleteActive = async () => {
    if (!activeItem || !organization) return;
    try {
      setIsManaging(true);
      setManageError("");
      await deleteDisposableAttendance(activeItem.id, organization.id);
      await reloadItems();
      showSuccessModal("Disposable attendance deleted.");
    } catch (error) {
      const message = getErrorMessage(error, "Could not delete disposable attendance.");
      setManageError(message);
      showToast("error", message);
    } finally {
      setIsManaging(false);
    }
  };

  const handleExport = () => {
    if (!activeItem) return;
    const headers = ["Submitted at", ...activeItem.fields.map((field) => field.label)];
    const rows = responses.map((response) => [
      response.submittedAtISO,
      ...activeItem.fields.map((field) => response.values[field.id] ?? "")
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const filename = `${organization?.name ?? "org"}-${toSlug(activeItem.title)}-disposable-attendance.csv`;
    downloadCsv(filename, csv);
  };

  const handleExportFiltered = () => {
    if (!activeItem) return;
    const headers = ["Submitted at", ...activeItem.fields.map((field) => field.label)];
    const rows = filteredResponses.map((response) => [
      response.submittedAtISO,
      ...activeItem.fields.map((field) => response.values[field.id] ?? "")
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const filterSuffix = responseFilter === "all" ? "all" : responseFilter;
    const filename = `${organization?.name ?? "org"}-${toSlug(activeItem.title)}-disposable-attendance-${filterSuffix}.csv`;
    downloadCsv(filename, csv);
  };

  const handleCopyPublicLink = async () => {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      showSuccessModal("Public check-in link copied.");
    } catch {
      showToast("error", "Could not copy link. Please copy manually.");
    }
  };

  const handleConfirmResponseCheckIn = async () => {
    if (!activeItem || !organization || !pendingCheckInResponse) return;

    try {
      setIsCheckingInResponse(true);
      await checkInDisposableAttendanceResponse({
        attendanceId: activeItem.id,
        responseId: pendingCheckInResponse.id,
        orgId: organization.id
      });
      await reloadResponses(activeItem.id);
      showSuccessModal("Attendee checked in successfully.");
      setPendingCheckInResponse(null);
    } catch (error) {
      const message = getErrorMessage(error, "Could not check in attendee.");
      setManageError(message);
      showToast("error", message);
    } finally {
      setIsCheckingInResponse(false);
    }
  };

  const handleRefreshResponses = async () => {
    if (!activeItem) return;
    try {
      setIsRefreshingResponses(true);
      await reloadResponses(activeItem.id);
    } finally {
      setIsRefreshingResponses(false);
    }
  };

  if (!organization) {
    return (
      <section className="panel disposable-page">
        <div className="panel-header">
          <h2>Disposable attendance</h2>
          <p className="muted">Select an organization to manage disposable attendance.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel disposable-page">
      {toast ? (
        <div className={`toast-banner ${toast.kind}`} role="status" aria-live="polite">
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message">
            ×
          </button>
        </div>
      ) : null}

      <div className="panel-header disposable-header">
        <div>
          <h2>Disposable attendance</h2>
          <p className="muted">
            Create event-based attendance forms outside regular staff check-ins.
          </p>
        </div>
        <div className="disposable-header-actions">
          <div className="pill-row">
            <span className="pill">Plan: {planTier}</span>
            <span className="pill">
              {items.length}/{limit} forms used
            </span>
          </div>
          <button
            className="btn solid"
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            disabled={!canCreate}
          >
            {canCreate ? "Create disposable attendance" : "Tier limit reached"}
          </button>
        </div>
      </div>

      <div className="disposable-manage panel">
        <h3>Manage disposable attendance</h3>
        {loadError ? <p className="auth-error">{loadError}</p> : null}
        {manageError ? <p className="auth-error">{manageError}</p> : null}

        {items.length === 0 ? (
          <div className="empty-state compact">
            <p className="muted">No disposable attendance created yet.</p>
          </div>
        ) : (
          <label className="disposable-select-row">
            Select attendance event
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} • {formatDateLong(item.eventDateISO)} • {item.isArchived ? "Archived" : "Active"}
                </option>
              ))}
            </select>
          </label>
        )}

        {activeItem ? (
          <>
            <div className="section-header-row">
              <h3>{activeItem.title}</h3>
              <div className="disposable-actions">
                <button
                  className="btn ghost"
                  type="button"
                  onClick={handleToggleArchive}
                  disabled={isManaging || isSubmitting || isCreating || isSavingFields}
                >
                  {activeItem.isArchived ? "Reopen" : "Archive"}
                </button>
                <button className="btn ghost" type="button" onClick={handleExport}>
                  Export CSV
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={handleExportFiltered}
                  disabled={responses.length === 0 || filteredResponses.length === 0}
                >
                  Export filtered CSV
                </button>
                <button
                  className="btn ghost danger"
                  type="button"
                  onClick={handleDeleteActive}
                  disabled={isManaging || isSubmitting || isCreating || isSavingFields}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="disposable-block">
              <p className="muted">{activeItem.description || "No description"}</p>
              <div className="pill-row">
                <span className="pill">{activeItem.location || "No location"}</span>
                <span className="pill">{recurrenceLabel(activeItem)}</span>
                {activeItem.allowPreRegister ? <span className="pill">Pre-register enabled</span> : null}
                <span className="pill">{responses.length} responses</span>
              </div>
            </div>

            <div className="disposable-block">
              <h4>Attendance summary</h4>
              <div className="disposable-summary-grid">
                <div className="disposable-summary-card">
                  <span className="label">Total responses</span>
                  <strong>{responseSummary.total}</strong>
                </div>
                {activeItem.allowPreRegister ? (
                  <>
                    <div className="disposable-summary-card preregistered">
                      <span className="label">Pre-registered</span>
                      <strong>{responseSummary.preRegistered}</strong>
                    </div>
                    <div className="disposable-summary-card checked-in">
                      <span className="label">Checked in</span>
                      <strong>{responseSummary.checkedIn}</strong>
                    </div>
                    <div className="disposable-summary-card rate">
                      <span className="label">Check-in rate</span>
                      <strong>{responseSummary.attendanceRate}%</strong>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="disposable-block">
              <details className="disposable-collapsible">
                <summary>Edit details to collect</summary>
                <div className="disposable-collapsible-content">
                  <p className="muted">Full name is always required for each attendee.</p>
                  <label className="workday-chip">
                    <input
                      type="checkbox"
                      checked={editCollect.email}
                      onChange={(event) =>
                        setEditCollect((prev) => ({ ...prev, email: event.target.checked }))
                      }
                      disabled={isSavingFields || isManaging}
                    />
                    Email
                  </label>
                  <label className="workday-chip">
                    <input
                      type="checkbox"
                      checked={editCollect.phone}
                      onChange={(event) =>
                        setEditCollect((prev) => ({ ...prev, phone: event.target.checked }))
                      }
                      disabled={isSavingFields || isManaging}
                    />
                    Phone number
                  </label>
                  <label className="workday-chip">
                    <input
                      type="checkbox"
                      checked={editCollect.occupation}
                      onChange={(event) =>
                        setEditCollect((prev) => ({ ...prev, occupation: event.target.checked }))
                      }
                      disabled={isSavingFields || isManaging}
                    />
                    Occupation
                  </label>
                  <label className="workday-chip">
                    <input
                      type="checkbox"
                      checked={editCollect.address}
                      onChange={(event) =>
                        setEditCollect((prev) => ({ ...prev, address: event.target.checked }))
                      }
                      disabled={isSavingFields || isManaging}
                    />
                    Address
                  </label>

                  <div className="disposable-custom-row">
                    <input
                      type="text"
                      value={editCustomFieldInput}
                      onChange={(event) => setEditCustomFieldInput(event.target.value)}
                      placeholder="Add custom detail field"
                      disabled={isSavingFields || isManaging}
                    />
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={handleAddEditCustomField}
                      disabled={isSavingFields || isManaging}
                    >
                      Add field
                    </button>
                  </div>

                  {editCustomFields.length > 0 ? (
                    <div className="pill-row removable-pill-row">
                      {editCustomFields.map((field) => (
                        <span className="pill removable-pill" key={field.id}>
                          {field.label}
                          <button
                            type="button"
                            onClick={() => handleRemoveEditCustomField(field.id)}
                            aria-label={`Remove ${field.label}`}
                            disabled={isSavingFields || isManaging}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {editFieldsError ? <p className="auth-error">{editFieldsError}</p> : null}
                  <button
                    className="btn solid"
                    type="button"
                    onClick={handleSaveCollectedDetails}
                    disabled={isSavingFields || isManaging || isSubmitting || isCreating}
                  >
                    {isSavingFields ? "Saving..." : "Save details collected"}
                  </button>
                </div>
              </details>
            </div>

            <div className="disposable-block share-block">
              <details className="disposable-collapsible">
                <summary>Public self check-in</summary>
                <div className="disposable-collapsible-content">
                  <p className="muted">
                    Share this link or QR code so attendees can check in themselves.
                    Admin check-in still works below.
                  </p>
                  <label>
                    Shareable link
                    <input type="text" value={publicLink} readOnly />
                  </label>
                  <div className="disposable-actions">
                    <button className="btn ghost" type="button" onClick={handleCopyPublicLink}>
                      Copy link
                    </button>
                    <a className="btn ghost" href={publicLink} target="_blank" rel="noreferrer">
                      Open public form
                    </a>
                  </div>
                  {qrImageUrl ? (
                    <img
                      className="share-qr"
                      src={qrImageUrl}
                      alt="QR code for public disposable attendance check-in"
                    />
                  ) : null}
                </div>
              </details>
            </div>

            {!activeItem.isArchived ? (
              <div className="disposable-block">
                <h4>Take attendance</h4>
                <div className="disposable-response-form">
                  {activeItem.fields.map((field) => (
                    <label key={field.id}>
                      {field.label}
                      <input
                        type={field.type === "email" ? "email" : "text"}
                        value={responseValues[field.id] ?? ""}
                        onChange={(event) =>
                          setResponseValues((prev) => ({
                            ...prev,
                            [field.id]: event.target.value
                          }))
                        }
                        placeholder={`Enter ${fieldTypeToLabel(field.type).toLowerCase()}`}
                      />
                    </label>
                  ))}
                  {responseError ? <p className="auth-error">{responseError}</p> : null}
                  <button
                    className="btn solid"
                    type="button"
                    onClick={handleSubmitResponse}
                    disabled={isSubmitting || isManaging || isSavingFields}
                  >
                    Submit attendance response
                  </button>
                </div>
              </div>
            ) : null}

            <div className="disposable-responses">
              <div className="section-header-row">
                <h4>Responses</h4>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={handleRefreshResponses}
                  disabled={isRefreshingResponses || isManaging}
                >
                  {isRefreshingResponses ? "Refreshing..." : "Refresh responses"}
                </button>
              </div>
              {responses.length === 0 ? (
                <p className="muted">No responses yet.</p>
              ) : (
                <>
                  {activeItem.allowPreRegister ? (
                    <div className="disposable-filters">
                      <button
                        type="button"
                        className={`filter-pill ${responseFilter === "all" ? "active" : ""}`}
                        onClick={() => setResponseFilter("all")}
                      >
                        All ({responses.length})
                      </button>
                      <button
                        type="button"
                        className={`filter-pill ${responseFilter === "preregistered" ? "active" : ""}`}
                        onClick={() => setResponseFilter("preregistered")}
                      >
                        Pre-registered ({responseSummary.preRegistered})
                      </button>
                      <button
                        type="button"
                        className={`filter-pill ${responseFilter === "checked-in" ? "active" : ""}`}
                        onClick={() => setResponseFilter("checked-in")}
                      >
                        Checked in ({responseSummary.checkedIn})
                      </button>
                    </div>
                  ) : null}

                  {filteredResponses.length === 0 ? (
                    <p className="muted">No responses for this filter.</p>
                  ) : (
                    <div className="disposable-table-wrap">
                      <table className="disposable-table">
                        <thead>
                          <tr>
                            {responseColumns.map((column) => (
                              <th key={column.key}>{column.label}</th>
                            ))}
                            {activeItem.allowPreRegister ? <th>Actions</th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredResponses.map((response) => (
                            <tr key={response.id}>
                              {responseColumns.map((column) => {
                                if (column.key === "submittedAtISO") {
                                  return <td key={`${response.id}-${column.key}`}>{formatDateLong(response.submittedAtISO.slice(0, 10))}</td>;
                                }
                                if (column.key === "status") {
                                  const statusValue = response.status === "checked-in" ? "Checked in" : "Pre-registered";
                                  return (
                                    <td key={`${response.id}-${column.key}`}>
                                      <span
                                        className={`disposable-status ${response.status === "checked-in" ? "checked-in" : "preregistered"}`}
                                      >
                                        {statusValue}
                                      </span>
                                    </td>
                                  );
                                }
                                if (column.key === "checkedInAtISO") {
                                  return (
                                    <td key={`${response.id}-${column.key}`}>
                                      {response.checkedInAtISO
                                        ? new Date(response.checkedInAtISO).toLocaleString()
                                        : "-"}
                                    </td>
                                  );
                                }
                                return <td key={`${response.id}-${column.key}`}>{response.values[column.key] || "—"}</td>;
                              })}
                              {activeItem.allowPreRegister ? (
                                <td>
                                  <button
                                    className="btn ghost"
                                    type="button"
                                    onClick={() => setPendingCheckInResponse(response)}
                                    disabled={
                                      response.status === "checked-in" ||
                                      isCheckingInResponse ||
                                      isManaging
                                    }
                                  >
                                    {response.status === "checked-in" ? "Checked-In" : "Check in"}
                                  </button>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : null}
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingCheckInResponse)}
        title="Confirm check-in"
        description="Check in this pre-registered attendee now?"
        onCancel={() => setPendingCheckInResponse(null)}
        onConfirm={handleConfirmResponseCheckIn}
        confirmLabel="Check in"
        isLoading={isCheckingInResponse}
        loadingLabel="Checking in..."
      />

      <SuccessModal
        isOpen={Boolean(successModalMessage)}
        title="Action Successful"
        message={successModalMessage}
        onClose={() => setSuccessModalMessage("")}
        closeLabel="Great"
      />

      {isCreateModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Create disposable attendance">
            <div className="modal-header">
              <h3>Create disposable attendance</h3>
            </div>

            <div className="disposable-create-modal">
              <label>
                Title
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Quarterly Townhall"
                  disabled={!canCreate || isCreating}
                />
              </label>
              <label>
                Description
                <input
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional notes"
                  disabled={!canCreate || isCreating}
                />
              </label>
              <label>
                Location
                <input
                  type="text"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Venue or room"
                  disabled={!canCreate || isCreating}
                />
              </label>
              <label>
                Event date
                <input
                  type="date"
                  value={eventDateISO}
                  onChange={(event) => setEventDateISO(event.target.value)}
                  disabled={!canCreate || isCreating}
                />
              </label>

              <div className="disposable-block">
                <label className="toggle-pill">
                  <input
                    type="checkbox"
                    checked={allowPreRegister}
                    onChange={(event) => {
                      const next = event.target.checked;
                      setAllowPreRegister(next);
                      if (next) {
                        setCollect((prev) => ({ ...prev, email: true }));
                      }
                    }}
                    disabled={!canCreate || isCreating}
                  />
                  Allow pre-register before event day
                </label>
                {allowPreRegister ? (
                  <p className="muted">
                    Participants can register before event day, then scan QR on event day for instant check-in using their email.
                  </p>
                ) : null}

                <strong>Details to collect</strong>
                <label className="workday-chip">
                  <input
                    type="checkbox"
                    checked={collect.email}
                    onChange={(event) =>
                      setCollect((prev) => ({ ...prev, email: event.target.checked }))
                    }
                    disabled={!canCreate || isCreating || allowPreRegister}
                  />
                  Email
                </label>
                <label className="workday-chip">
                  <input
                    type="checkbox"
                    checked={collect.phone}
                    onChange={(event) =>
                      setCollect((prev) => ({ ...prev, phone: event.target.checked }))
                    }
                    disabled={!canCreate || isCreating}
                  />
                  Phone number
                </label>
                <label className="workday-chip">
                  <input
                    type="checkbox"
                    checked={collect.occupation}
                    onChange={(event) =>
                      setCollect((prev) => ({ ...prev, occupation: event.target.checked }))
                    }
                    disabled={!canCreate || isCreating}
                  />
                  Occupation
                </label>
                <label className="workday-chip">
                  <input
                    type="checkbox"
                    checked={collect.address}
                    onChange={(event) =>
                      setCollect((prev) => ({ ...prev, address: event.target.checked }))
                    }
                    disabled={!canCreate || isCreating}
                  />
                  Address
                </label>

                <div className="disposable-custom-row">
                  <input
                    type="text"
                    value={customFieldInput}
                    onChange={(event) => setCustomFieldInput(event.target.value)}
                    placeholder="Add custom field (Others)"
                    disabled={!canCreate || isCreating}
                  />
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={handleAddCustomField}
                    disabled={!canCreate || isCreating}
                  >
                    Add field
                  </button>
                </div>
                {customFields.length > 0 ? (
                  <div className="pill-row removable-pill-row">
                    {customFields.map((field) => (
                      <span className="pill removable-pill" key={field}>
                        {field}
                        <button
                          type="button"
                          onClick={() => handleRemoveCreateCustomField(field)}
                          aria-label={`Remove ${field}`}
                          disabled={!canCreate || isCreating}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="disposable-block">
                <label className="toggle-pill">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(event) => {
                      const next = event.target.checked;
                      setIsRecurring(next);
                      if (!next) {
                        setRecurrenceMode("none");
                        setRecurrenceEndDateISO("");
                        setRecurrenceCustomRule("");
                      } else {
                        setRecurrenceMode("weekly");
                      }
                    }}
                    disabled={!canCreate || isCreating}
                  />
                  Recurring attendance
                </label>

                {isRecurring ? (
                  <>
                    <label>
                      Recurrence type
                      <select
                        value={recurrenceMode}
                        onChange={(event) =>
                          setRecurrenceMode(event.target.value as DisposableAttendance["recurrenceMode"])
                        }
                        disabled={!canCreate || isCreating}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom">Custom (irregular)</option>
                      </select>
                    </label>
                    {recurrenceMode === "custom" ? (
                      <label>
                        Manual schedule / duration details
                        <input
                          type="text"
                          value={recurrenceCustomRule}
                          onChange={(event) => setRecurrenceCustomRule(event.target.value)}
                          placeholder="e.g. 1st and 3rd Fridays, skip public holidays"
                          disabled={!canCreate || isCreating}
                        />
                      </label>
                    ) : (
                      <label>
                        Repeat until (optional)
                        <input
                          type="date"
                          value={recurrenceEndDateISO}
                          onChange={(event) => setRecurrenceEndDateISO(event.target.value)}
                          disabled={!canCreate || isCreating}
                        />
                      </label>
                    )}
                  </>
                ) : null}
              </div>

              {createError ? <p className="auth-error">{createError}</p> : null}
            </div>

            <div className="modal-actions">
              <button
                className="btn ghost"
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button className="btn solid" type="button" onClick={handleCreate} disabled={!canCreate || isCreating}>
                {isCreating ? "Creating..." : "Create disposable attendance"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default DisposableAttendancePage;
