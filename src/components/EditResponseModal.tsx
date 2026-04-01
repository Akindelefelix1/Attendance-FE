import type { DisposableAttendanceResponse, DisposableField } from "../types";
import { useState } from "react";

type Props = {
  isOpen: boolean;
  response: DisposableAttendanceResponse | null;
  fields: DisposableField[];
  onClose: () => void;
  onSave: (values: Record<string, string>) => Promise<void>;
  isLoading?: boolean;
  error?: string;
};

const EditResponseModal = ({ isOpen, response, fields, onClose, onSave, isLoading = false, error }: Props) => {
  const [values, setValues] = useState<Record<string, string>>({});

  // Initialize or update form values when response changes
  if (isOpen && response) {
    const currentValues = values;
    const shouldReset = !values["_initialized"] || currentValues["_responseId"] !== response.id;
    if (shouldReset) {
      const newValues: Record<string, string> = { _initialized: "true", _responseId: response.id };
      fields.forEach((field) => {
        newValues[field.id] = response.values[field.id] || "";
      });
      setValues(newValues);
    }
  }

  const handleChange = (fieldId: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSave = async () => {
    if (!response) return;
    
    const submitValues: Record<string, string> = {};
    fields.forEach((field) => {
      submitValues[field.id] = values[field.id] || "";
    });

    await onSave(submitValues);
  };

  if (!isOpen || !response) {
    return null;
  }

  // Get the staff name (usually from full-name field)
  const fullNameField = fields.find((f) => f.type === "full-name");
  const staffName = fullNameField ? response.values[fullNameField.id] : "Unknown";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit details - ${staffName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Edit Details - {staffName}</h3>
          <button className="btn ghost" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div>
          {error && <div className="error-message">{error}</div>}
          
          {fields.map((field) => (
            <label key={field.id} className="modal-label" htmlFor={field.id}>
              <span className="label-text">
                {field.label}
                {field.required ? <span className="required">*</span> : null}
              </span>
              {field.type === "address" ? (
                <textarea
                  id={field.id}
                  value={values[field.id] || ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  disabled={isLoading}
                />
              ) : (
                <input
                  id={field.id}
                  type={field.type === "email" ? "email" : "text"}
                  value={values[field.id] || ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  disabled={isLoading}
                />
              )}
            </label>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button 
            className="btn solid" 
            type="button"
            onClick={handleSave} 
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditResponseModal;
