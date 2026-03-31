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

  // Debug log
  useEffect(() => {
    console.log('PublicHolidaysPage mounted with organization:', organization);
  }, []);

  useEffect(() => {
    console.log('Organization changed:', organization);
    if (organization) {
      loadHolidays();
    }
  }, [organization]);

  const loadHolidays = async () => {
    if (!organization) return;
    setLoading(true);
    setError("");
    try {
      console.log('Fetching holidays for org:', organization.id);
      const data = await listPublicHolidays(organization.id);
      console.log('Holidays loaded:', data);
      setHolidays(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load holidays";
      console.error('Error loading holidays:', err);
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
        <div style={{ padding: '20px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
          <h2 style={{ margin: '0 0 8px 0' }}>Public Holidays</h2>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>Manage public holidays for your organization.</p>
        </div>
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999' }}>
          <h3>No organization selected</h3>
          <p>Please select an organization from the top dropdown to manage public holidays.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="layout full">
      <div style={{ padding: '20px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0' }}>Public Holidays</h2>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            Manage public holidays. Staff won't be marked absent on public holidays.
          </p>
        </div>
        <div style={{ marginTop: '12px' }}>
          <button
            style={{
              padding: '8px 16px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: formMode !== null || loading ? 'not-allowed' : 'pointer',
              opacity: formMode !== null || loading ? 0.6 : 1,
              fontSize: '14px'
            }}
            type="button"
            onClick={handleAddClick}
            disabled={formMode !== null || loading}
          >
            + Add Holiday
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#fee', color: '#c00', borderRadius: '4px', margin: '0 20px 16px 20px', border: '1px solid #f99' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {formMode !== null && (
        <div style={{ margin: '0 20px 20px 20px', padding: '20px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
          <h3 style={{ margin: '0 0 16px 0' }}>{formMode === "add" ? "Add New Holiday" : "Edit Holiday"}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
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

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                type="submit"
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#0066cc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  fontSize: '14px'
                }}
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
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#e8e8e8',
                  color: '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  fontSize: '14px'
                }}
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
        <div className="panel" style={{ padding: '32px', textAlign: 'center', color: '#666' }}>
          <p>⏳ Loading holidays...</p>
        </div>
      ) : holidays.length === 0 ? (
        <div className="panel" style={{ padding: '32px', textAlign: 'center', color: '#666' }}>
          <h3>No public holidays yet</h3>
          <p>Click "Add Holiday" to create your first public holiday.</p>
        </div>
      ) : (
        <div style={{ margin: '0 20px', padding: '20px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9f9f9', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Name</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Type</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Description</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((holiday) => (
                  <tr key={holiday.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>{holiday.name}</td>
                    <td style={{ padding: '12px' }}>{holiday.dateISO}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ backgroundColor: holiday.isRecurring ? '#e3f2fd' : '#f5f5f5', padding: '4px 8px', borderRadius: '3px', fontSize: '12px' }}>
                        {holiday.isRecurring ? "Recurring" : "One-time"}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {holiday.description || "—"}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        style={{
                          padding: '4px 8px',
                          marginRight: '8px',
                          backgroundColor: '#f0f0f0',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: submitting || deleteConfirm !== null ? 'not-allowed' : 'pointer',
                          opacity: submitting || deleteConfirm !== null ? 0.6 : 1
                        }}
                        onClick={() => handleEditClick(holiday)}
                        disabled={submitting || deleteConfirm !== null}
                        title="Edit"
                      >
                        ✎ Edit
                      </button>
                      <button
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#ffebee',
                          color: '#c00',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: submitting ? 'not-allowed' : 'pointer',
                          opacity: submitting ? 0.6 : 1
                        }}
                        onClick={() => setDeleteConfirm(holiday.id)}
                        disabled={submitting}
                        title="Delete"
                      >
                        ✕ Delete
                      </button>
                      {deleteConfirm === holiday.id && (
                        <div style={{ position: 'absolute', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '4px', padding: '12px', marginTop: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10 }}>
                          <p style={{ margin: '0 0 12px 0' }}>Delete "{holiday.name}"?</p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#c00',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                opacity: submitting ? 0.6 : 1,
                                fontSize: '12px'
                              }}
                              onClick={() => handleDelete(holiday.id)}
                              disabled={submitting}
                            >
                              {submitting ? "..." : "Yes"}
                            </button>
                            <button
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#f0f0f0',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                opacity: submitting ? 0.6 : 1,
                                fontSize: '12px'
                              }}
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
