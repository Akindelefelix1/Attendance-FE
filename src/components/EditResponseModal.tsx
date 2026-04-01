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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Details - {staffName}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            {fields.map((field) => (
              <div key={field.id} className="form-field">
                <label htmlFor={field.id}>
                  {field.label}
                  {field.required ? <span className="required">*</span> : null}
                </label>
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
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button 
            className="btn solid" 
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
