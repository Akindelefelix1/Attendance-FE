import { useState, useEffect } from "react";
import type { Organization, PublicHoliday } from "../types";
import {
  listPublicHolidays,
  createPublicHoliday,
  updatePublicHoliday,
  deletePublicHoliday,
  notifyStaffAboutHoliday
} from "../lib/api";

type Props = {
  organization: Organization | null;
};

type FormMode = "add" | "edit";
type SendMode = "instant" | "scheduled";

const PublicHolidaysPage = ({ organization }: Props) => {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    dateISO: "",
    isRecurring: false,
    recurrencePattern: "",
    description: "",
    affectsAllStaff: true
  });

  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [notifyModal, setNotifyModal] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<SendMode>("instant");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    if (organization) {
      loadHolidays();
    }
  }, [organization]);

  const loadHolidays = async () => {
    if (!organization) return;
    setLoading(true);
    setError("");
    try {
      const data = await listPublicHolidays(organization.id);
      setHolidays(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load holidays";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      dateISO: "",
      isRecurring: false,
      recurrencePattern: "",
      description: "",
      affectsAllStaff: true
    });
    setEditingHoliday(null);
    setFormMode(null);
  };

  const handleAddClick = () => {
    resetForm();
    setFormMode("add");
  };

  const handleEditClick = (holiday: PublicHoliday) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      dateISO: holiday.dateISO,
      isRecurring: holiday.isRecurring,
      recurrencePattern: holiday.recurrencePattern || "",
      description: holiday.description,
      affectsAllStaff: holiday.affectsAllStaff
    });
    setFormMode("edit");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    if (!formData.name.trim() || !formData.dateISO) {
      setError("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (formMode === "add") {
        await createPublicHoliday(organization.id, {
          name: formData.name.trim(),
          dateISO: formData.dateISO,
          isRecurring: formData.isRecurring,
          recurrencePattern: formData.isRecurring ? formData.recurrencePattern : undefined,
          description: formData.description,
          affectsAllStaff: formData.affectsAllStaff
        });
      } else if (formMode === "edit" && editingHoliday) {
        await updatePublicHoliday(organization.id, editingHoliday.id, {
          name: formData.name.trim(),
          dateISO: formData.dateISO,
          isRecurring: formData.isRecurring,
          recurrencePattern: formData.isRecurring ? formData.recurrencePattern : undefined,
          description: formData.description,
          affectsAllStaff: formData.affectsAllStaff
        });
      }
      await loadHolidays();
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Operation failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (holidayId: string) => {
    if (!organization) return;

    setSubmitting(true);
    setError("");

    try {
      await deletePublicHoliday(organization.id, holidayId);
      await loadHolidays();
      setDeleteConfirm(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotifyStaff = async (holidayId: string) => {
    if (!organization) return;

    setNotifying(true);
    setError("");

    try {
      const payload = {
        sendMode,
        ...(sendMode === "scheduled" && { scheduledAt })
      };
      await notifyStaffAboutHoliday(organization.id, holidayId, payload);
      setError("");
      // Show success message
      setTimeout(() => {
        setNotifyModal(null);
        setSendMode("instant");
        setScheduledAt("");
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to notify staff";
      setError(message);
    } finally {
      setNotifying(false);
    }
  };

  if (!organization) {
    return (
      <main className="layout full">
        <div className="panel settings-header">
          <div>
            <h2>Public Holidays</h2>
            <p className="muted">Manage public holidays for your organization.</p>
          </div>
        </div>
        <div className="empty-state">
          <h3>No organization selected</h3>
          <p>Please select an organization from the top dropdown.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="layout full">
      <div className="panel settings-header">
        <div>
          <h2>Public Holidays</h2>
          <p className="muted">
            Manage public holidays. Staff won't be marked absent on public holidays.
          </p>
        </div>
        <div className="settings-actions">
          <button
            className="btn solid"
            type="button"
            onClick={handleAddClick}
            disabled={formMode !== null || loading}
          >
            Add Holiday
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {formMode !== null && (
        <div className="panel form-section">
          <h3>{formMode === "add" ? "Add New Holiday" : "Edit Holiday"}</h3>
          <form onSubmit={handleSubmit} className="holiday-form">
            <label>
              Holiday name *
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Christmas Day"
                disabled={submitting}
              />
            </label>

            <label>
              Date *
              <input
                type="date"
                value={formData.dateISO}
                onChange={(e) => setFormData({ ...formData, dateISO: e.target.value })}
                disabled={submitting}
              />
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) =>
                  setFormData({ ...formData, isRecurring: e.target.checked })
                }
                disabled={submitting}
              />
              Recurring annually
            </label>

            {formData.isRecurring && (
              <label>
                RRULE Pattern
                <input
                  type="text"
                  value={formData.recurrencePattern}
                  onChange={(e) =>
                    setFormData({ ...formData, recurrencePattern: e.target.value })
                  }
                  placeholder="FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25"
                  disabled={submitting}
                  title="iCalendar RRULE format"
                />
                <small>Example: FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25 (Dec 25 every year)</small>
              </label>
            )}

            <label>
              Description
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional notes about this holiday"
                disabled={submitting}
                rows={3}
              />
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.affectsAllStaff}
                onChange={(e) =>
                  setFormData({ ...formData, affectsAllStaff: e.target.checked })
                }
                disabled={submitting}
              />
              Applies to all staff
            </label>

            <div className="form-actions">
              <button
                type="submit"
                className="btn solid"
                disabled={submitting}
              >
                {submitting
                  ? formMode === "add"
                    ? "Adding..."
                    : "Updating..."
                  : formMode === "add"
                    ? "Add Holiday"
                    : "Update Holiday"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={resetForm}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <p>Loading holidays...</p>
        </div>
      ) : holidays.length === 0 ? (
        <div className="empty-state">
          <h3>No public holidays yet</h3>
          <p>Click "Add Holiday" to create your first public holiday.</p>
        </div>
      ) : (
        <div className="panel holidays-table">
          <div className="holidays-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((holiday) => (
                  <tr key={holiday.id}>
                    <td className="holiday-name">{holiday.name}</td>
                    <td className="holiday-date">{holiday.dateISO}</td>
                    <td>
                      <span className={`holiday-type-badge ${holiday.isRecurring ? "recurring" : "one-time"}`}>
                        {holiday.isRecurring ? "Recurring" : "One-time"}
                      </span>
                    </td>
                    <td className="holiday-description">
                      {holiday.description || "—"}
                    </td>
                    <td className="holiday-actions">
                      <button
                        className="action-button"
                        onClick={() => handleEditClick(holiday)}
                        disabled={submitting || deleteConfirm !== null || notifyModal !== null}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        className="action-button"
                        onClick={() => setNotifyModal(holiday.id)}
                        disabled={submitting || deleteConfirm !== null || notifyModal !== null}
                        title="Notify Staff"
                      >
                        ✉
                      </button>
                      <button
                        className="action-button danger"
                        onClick={() => setDeleteConfirm(holiday.id)}
                        disabled={submitting || notifyModal !== null}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => !submitting && setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Holiday</h3>
            <p>Are you sure you want to delete "{holidays.find((h) => h.id === deleteConfirm)?.name}"?</p>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>This action cannot be undone.</p>
            <div className="modal-actions">
              <button
                className="btn ghost"
                onClick={() => setDeleteConfirm(null)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="btn solid danger"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={submitting}
              >
                {submitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notify Staff Modal */}
      {notifyModal && (
        <div className="modal-backdrop" onClick={() => !notifying && setNotifyModal(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Notify Staff About Holiday</h3>
              <p className="modal-subtitle">Send notification about "<strong>{holidays.find((h) => h.id === notifyModal)?.name}</strong>" to all registered staff</p>
            </div>

            <div className="notify-options">
              <label className="notify-option-card">
                <div className="notify-option-input">
                  <input
                    type="radio"
                    name="sendMode"
                    value="instant"
                    checked={sendMode === "instant"}
                    onChange={() => setSendMode("instant")}
                    disabled={notifying}
                  />
                </div>
                <div className="notify-option-content">
                  <div className="notify-option-title">Send Instantly</div>
                  <div className="notify-option-desc">Notify all staff right away</div>
                </div>
              </label>

              <label className="notify-option-card">
                <div className="notify-option-input">
                  <input
                    type="radio"
                    name="sendMode"
                    value="scheduled"
                    checked={sendMode === "scheduled"}
                    onChange={() => setSendMode("scheduled")}
                    disabled={notifying}
                  />
                </div>
                <div className="notify-option-content">
                  <div className="notify-option-title">Schedule for Later</div>
                  <div className="notify-option-desc">Send notification at a specific time</div>
                </div>
              </label>
            </div>

            {sendMode === "scheduled" && (
              <div className="scheduled-input-wrapper">
                <label className="modal-label">
                  <span className="label-text">Date & Time</span>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    disabled={notifying}
                    required={sendMode === "scheduled"}
                  />
                </label>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button
                className="btn ghost"
                onClick={() => setNotifyModal(null)}
                disabled={notifying}
              >
                Cancel
              </button>
              <button
                className="btn solid"
                onClick={() => handleNotifyStaff(notifyModal)}
                disabled={notifying || (sendMode === "scheduled" && !scheduledAt)}
              >
                {notifying ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default PublicHolidaysPage;
