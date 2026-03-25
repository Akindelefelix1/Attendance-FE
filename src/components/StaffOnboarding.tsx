import { useState } from "react";
import type { StaffMember } from "../types";

type Props = {
  onAddStaff: (payload: Omit<StaffMember, "id">) => void;
  roles: string[];
  disabled?: boolean;
  limitReached?: boolean;
  limitLabel?: string;
  isLoading?: boolean;
};

const StaffOnboarding = ({
  onAddStaff,
  roles,
  disabled = false,
  limitReached = false,
  limitLabel = "0",
  isLoading = false
}: Props) => {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState(roles[0] ?? "");
  const [email, setEmail] = useState("");

  const reset = () => {
    setFullName("");
    setRole(roles[0] ?? "");
    setEmail("");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fullName || !role || !email) return;
    onAddStaff({ fullName, role, email });
    reset();
  };

  return (
    <form className="onboard" onSubmit={handleSubmit}>
      <div className="panel-header">
        <h3>Onboard staff</h3>
        <p className="muted">Add new team members for this organization.</p>
      </div>
      {limitReached ? (
        <p className="muted">
          Staff limit reached ({limitLabel}). Upgrade your plan to add more staff.
        </p>
      ) : null}
      <label>
        Full name
        <input
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="e.g. Ifeanyi Eze"
          disabled={disabled || isLoading || limitReached}
          required
        />
      </label>
      <label>
        Role
        {roles.length > 0 ? (
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            disabled={disabled || isLoading || limitReached}
            required
          >
            {roles.map((roleOption) => (
              <option key={roleOption} value={roleOption}>
                {roleOption}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="e.g. Customer Success"
            disabled={disabled || isLoading || limitReached}
            required
          />
        )}
      </label>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@company.com"
          disabled={disabled || isLoading || limitReached}
          required
        />
      </label>
      <button
        className="btn solid"
        type="submit"
        disabled={disabled || isLoading || limitReached}
      >
        {limitReached ? "Staff limit reached" : isLoading ? "Adding..." : "Add staff member"}
      </button>
    </form>
  );
};

export default StaffOnboarding;
