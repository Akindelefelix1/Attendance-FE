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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Staff Member</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="fullName">
              Full Name <span className="required">*</span>
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter full name"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              Email <span className="required">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">
              Role <span className="required">*</span>
            </label>
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
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button
            className="btn solid"
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
