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

  const [responseValues, setResponseValues] = useState<Record<string, string>>({});
  const [responseError, setResponseError] = useState("");
  const [shareStatus, setShareStatus] = useState("");

  const activeItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const planTier = organization?.settings.planTier ?? "free";
  const limit = tierLimits[planTier];

  const reloadItems = async () => {
    if (!organization) {
      setItems([]);
      setSelectedId("");
      return;
    }
    const next = await listDisposableAttendances(organization.id);
    setItems(next);
    setSelectedId((prev) => {
      if (prev && next.some((item) => item.id === prev)) return prev;
      return next[0]?.id ?? "";
    });
  };

  const reloadResponses = async (attendanceId: string) => {
    if (!organization) {
      setResponses([]);
      return;
    }
    const next = await listDisposableAttendanceResponses(attendanceId, organization.id);
    setResponses(next);
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
      return;
    }
    const initial: Record<string, string> = {};
    activeItem.fields.forEach((field) => {
      initial[field.id] = "";
    });
    setResponseValues(initial);
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

  const handleCreate = async () => {
    if (!organization) return;
    if (!canCreate) return;
    setCreateError("");
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

    await reloadItems();
  };

  const handleSubmitResponse = async () => {
    if (!activeItem || !organization) return;
    setResponseError("");

    for (const field of activeItem.fields) {
      const value = responseValues[field.id]?.trim() ?? "";
      if (field.required && !value) {
        setResponseError(`Please fill ${field.label}.`);
        return;
      }
    }

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
      setShareStatus("Public check-in link copied.");
      window.setTimeout(() => setShareStatus(""), 2000);
    } catch {
      setShareStatus("Could not copy link. Please copy manually.");
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
      <div className="panel-header disposable-header">
        <div>
          <h2>Disposable attendance</h2>
          <p className="muted">
            Create event-based attendance forms outside regular staff check-ins.
          </p>
        </div>
        <div className="pill-row">
          <span className="pill">Plan: {planTier}</span>
          <span className="pill">
            {items.length}/{limit} forms used
          </span>
        </div>
      </div>

      <div className="disposable-layout">
        <div className="disposable-create panel">
          <h3>Create disposable attendance</h3>
          <label>
            Title
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Quarterly Townhall"
              disabled={!canCreate}
            />
          </label>
          <label>
            Description
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional notes"
              disabled={!canCreate}
            />
          </label>
          <label>
            Location
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Venue or room"
              disabled={!canCreate}
            />
          </label>
          <label>
            Event date
            <input
              type="date"
              value={eventDateISO}
              onChange={(event) => setEventDateISO(event.target.value)}
              disabled={!canCreate}
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
                disabled={!canCreate}
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
                disabled={!canCreate}
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
                disabled={!canCreate}
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
                disabled={!canCreate}
              />
              Address
            </label>

            <div className="disposable-custom-row">
              <input
                type="text"
                value={customFieldInput}
                onChange={(event) => setCustomFieldInput(event.target.value)}
                placeholder="Add custom field (Others)"
                disabled={!canCreate}
              />
              <button className="btn ghost" type="button" onClick={handleAddCustomField} disabled={!canCreate}>
                Add field
              </button>
            </div>
            {customFields.length > 0 ? (
              <div className="pill-row">
                {customFields.map((field) => (
                  <span className="pill" key={field}>
                    {field}
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
                disabled={!canCreate}
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
                    disabled={!canCreate}
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
                      disabled={!canCreate}
                    />
                  </label>
                ) : (
                  <label>
                    Repeat until (optional)
                    <input
                      type="date"
                      value={recurrenceEndDateISO}
                      onChange={(event) => setRecurrenceEndDateISO(event.target.value)}
                      disabled={!canCreate}
                    />
                  </label>
                )}
              </>
            ) : null}
          </div>

          {createError ? <p className="auth-error">{createError}</p> : null}

          <button className="btn solid" type="button" onClick={handleCreate} disabled={!canCreate}>
            {canCreate ? "Create disposable attendance" : "Tier limit reached"}
          </button>
        </div>

        <div className="disposable-manage panel">
          <h3>Manage disposable attendance</h3>
          {items.length === 0 ? (
            <div className="empty-state compact">
              <p className="muted">No disposable attendance created yet.</p>
            </div>
          ) : (
            <div className="disposable-list">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`disposable-item ${selectedId === item.id ? "active" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <strong>{item.title}</strong>
                  <span className="muted">{formatDateLong(item.eventDateISO)}</span>
                  <span className="muted">{recurrenceLabel(item)}</span>
                  <span className="muted">{item.isArchived ? "Archived" : "Active"}</span>
                </button>
              ))}
            </div>
          )}

          {activeItem ? (
            <>
              <div className="section-header-row">
                <h3>{activeItem.title}</h3>
                <div className="disposable-actions">
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() =>
                      void updateDisposableAttendance(activeItem.id, organization.id, {
                        isArchived: !activeItem.isArchived
                      }).then(() => reloadItems())
                    }
                  >
                    {activeItem.isArchived ? "Reopen" : "Archive"}
                  </button>
                  <button className="btn ghost" type="button" onClick={handleExport}>
                    Export CSV
                  </button>
                  <button
                    className="btn ghost danger"
                    type="button"
                    onClick={() =>
                      void deleteDisposableAttendance(activeItem.id, organization.id).then(
                        () => reloadItems()
                      )
                    }
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
                {shareStatus ? <p className="muted">{shareStatus}</p> : null}
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
                    <button className="btn solid" type="button" onClick={handleSubmitResponse}>
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
                  <div className="analytics-table compact-table">
                    <div className="analytics-head">
                      <span>Submitted</span>
                      <span>Attendee</span>
                      <span>Details</span>
                    </div>
                    {responses.map((response) => (
                      <div className="analytics-row" key={response.id}>
                        <div className="cell" data-label="Submitted">
                          {formatDateLong(response.submittedAtISO.slice(0, 10))}
                        </div>
                        <div className="cell" data-label="Attendee">
                          {response.values["full-name"] || "—"}
                        </div>
                        <div className="cell" data-label="Details">
                          {activeItem.fields
                            .filter((field) => field.id !== "full-name")
                            .map((field) => `${field.label}: ${response.values[field.id] || "—"}`)
                            .join(" • ") || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default DisposableAttendancePage;
