import { useEffect, useMemo, useState } from "react";
import type {
  DisposableAttendance,
  DisposableAttendanceResponse,
  DisposableField,
  Organization
} from "../types";
import {
  createDisposableAttendance,
  deleteDisposableAttendance,
  listDisposableAttendances,
  listDisposableAttendanceResponses,
  submitDisposableAttendanceResponse,
  updateDisposableAttendance
} from "../lib/api";
import { formatDateLong, getTodayISO } from "../lib/time";

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

const standardFieldIds = new Set(["full-name", "email", "phone", "occupation", "address"]);

const DisposableAttendancePage = ({ organization }: Props) => {
  const [items, setItems] = useState<DisposableAttendance[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [responses, setResponses] = useState<DisposableAttendanceResponse[]>([]);

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

  const activeItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const planTier = organization?.settings.planTier ?? "free";
  const limit = tierLimits[planTier];

  const showToast = (kind: ToastState["kind"], message: string) => {
    setToast({ kind, message });
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
      return;
    }
    try {
      setManageError("");
      const next = await listDisposableAttendanceResponses(attendanceId, organization.id);
      setResponses(next);
    } catch (error) {
      setResponses([]);
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
      return;
    }
    void reloadResponses(selectedId);
  }, [selectedId]);

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
  }, [activeItem?.id]);

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
          isRecurring && recurrenceMode === "custom" ? recurrenceCustomRule.trim() : ""
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
      setIsCreateModalOpen(false);
      showToast("success", "Disposable attendance created.");

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
      await updateDisposableAttendance(activeItem.id, organization.id, { fields: nextFields });
      await reloadItems();
      await reloadResponses(activeItem.id);
      showToast("success", "Details to collect updated.");
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
      showToast("success", "Attendance response submitted.");
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
      showToast("success", activeItem.isArchived ? "Attendance reopened." : "Attendance archived.");
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
      showToast("success", "Disposable attendance deleted.");
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

  const handleCopyPublicLink = async () => {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      showToast("success", "Public check-in link copied.");
    } catch {
      showToast("error", "Could not copy link. Please copy manually.");
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
                <span className="pill">{responses.length} responses</span>
              </div>
            </div>

            <div className="disposable-block">
              <h4>Edit details to collect</h4>
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

            <div className="disposable-block share-block">
              <h4>Public self check-in</h4>
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
              <h4>Responses</h4>
              {responses.length === 0 ? (
                <p className="muted">No responses yet.</p>
              ) : (
                <div className="disposable-table-wrap">
                  <table className="disposable-table">
                    <thead>
                      <tr>
                        <th>Submitted</th>
                        {activeItem.fields.map((field) => (
                          <th key={field.id}>{field.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {responses.map((response) => (
                        <tr key={response.id}>
                          <td>{formatDateLong(response.submittedAtISO.slice(0, 10))}</td>
                          {activeItem.fields.map((field) => (
                            <td key={`${response.id}-${field.id}`}>{response.values[field.id] || "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

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
                <strong>Details to collect</strong>
                <label className="workday-chip">
                  <input
                    type="checkbox"
                    checked={collect.email}
                    onChange={(event) =>
                      setCollect((prev) => ({ ...prev, email: event.target.checked }))
                    }
                    disabled={!canCreate || isCreating}
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
