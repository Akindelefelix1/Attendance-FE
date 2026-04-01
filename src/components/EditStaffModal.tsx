import { useState, useEffect } from "react";
import type { StaffMember } from "../types";

type Props = {
  isOpen: boolean;
  staff: StaffMember | null;
  roles: string[];
  onClose: () => void;
  onSave: (staffId: string, changes: { fullName?: string; role?: string; email?: string }) => Promise<void>;
  isLoading?: boolean;
  error?: string;
};

const EditStaffModal = ({ isOpen, staff, roles, onClose, onSave, isLoading = false, error }: Props) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    if (staff) {
      setFullName(staff.fullName);
      setEmail(staff.email);
      setRole(staff.role);
    }
  }, [staff, isOpen]);

  const handleSave = async () => {
    if (!staff || !fullName.trim() || !email.trim() || !role.trim()) {
      return;
    }

    const changes: { fullName?: string; role?: string; email?: string } = {};

    if (fullName !== staff.fullName) {
      changes.fullName = fullName.trim();
    }
    if (email !== staff.email) {
      changes.email = email.trim();
    }
    if (role !== staff.role) {
      changes.role = role;
    }

    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    await onSave(staff.id, changes);
  };

  if (!isOpen || !staff) {
    return null;
  }

  const hasChanges =
    fullName !== staff.fullName ||
    email !== staff.email ||
    role !== staff.role;

  const canSave = fullName.trim() && email.trim() && role && hasChanges;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Edit staff member"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Edit Staff Member</h3>
          <button className="btn ghost" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div>
          {error && <div className="error-message">{error}</div>}

          <label className="modal-label" htmlFor="fullName">
            <span className="label-text">
              Full Name <span className="required">*</span>
            </span>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter full name"
              disabled={isLoading}
            />
          </label>

          <label className="modal-label" htmlFor="email">
            <span className="label-text">
              Email <span className="required">*</span>
            </span>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              disabled={isLoading}
            />
          </label>

          <label className="modal-label" htmlFor="role">
            <span className="label-text">
              Role <span className="required">*</span>
            </span>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isLoading || roles.length === 0}
            >
              <option value="">Select a role</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button
            className="btn solid"
            type="button"
            onClick={handleSave}
            disabled={isLoading || !canSave}
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditStaffModal;
