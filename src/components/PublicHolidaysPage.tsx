import { useState, useEffect } from "react";
import type { Organization, PublicHoliday } from "../types";
import {
  listPublicHolidays,
  createPublicHoliday,
  updatePublicHoliday,
  deletePublicHoliday
} from "../lib/api";

type Props = {
  organization: Organization | null;
};

type FormMode = "add" | "edit";

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

  if (!organization) {
    return (
      <main className="layout full">
        <div className="empty-state">
          <h3>No organization selected</h3>
          <p>Please select an organization to manage public holidays.</p>
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
                    <td className="holiday-type">
                      {holiday.isRecurring ? "Recurring" : "One-time"}
                    </td>
                    <td className="holiday-description">
                      {holiday.description || "—"}
                    </td>
                    <td className="holiday-actions">
                      <button
                        className="action-button"
                        onClick={() => handleEditClick(holiday)}
                        disabled={submitting || deleteConfirm !== null}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        className="action-button danger"
                        onClick={() => setDeleteConfirm(holiday.id)}
                        disabled={submitting}
                        title="Delete"
                      >
                        ✕
                      </button>
                      {deleteConfirm === holiday.id && (
                        <div className="delete-confirm">
                          <p>Delete "{holiday.name}"?</p>
                          <div className="confirm-actions">
                            <button
                              className="btn small danger"
                              onClick={() => handleDelete(holiday.id)}
                              disabled={submitting}
                            >
                              {submitting ? "..." : "Yes"}
                            </button>
                            <button
                              className="btn small ghost"
                              onClick={() => setDeleteConfirm(null)}
                              disabled={submitting}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
};

export default PublicHolidaysPage;
