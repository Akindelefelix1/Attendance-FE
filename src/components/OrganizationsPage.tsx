import { useEffect, useMemo, useState } from "react";
import type { Organization } from "../types";

type Props = {
  organizations: Organization[];
  onAdd: (name: string, location: string) => void;
  onUpdate: (orgId: string, name: string, location: string) => void;
  onRemove: (orgId: string) => void;
  orgLimit: number;
  orgCount: number;
  isBusy?: boolean;
  busyActionId?: string | null;
};

type DraftMap = Record<string, { name: string; location: string }>;

const OrganizationsPage = ({
  organizations,
  onAdd,
  onUpdate,
  onRemove,
  orgLimit,
  orgCount,
  isBusy = false,
  busyActionId = null
}: Props) => {
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");

  useEffect(() => {
    const next: DraftMap = {};
    organizations.forEach((org) => {
      next[org.id] = { name: org.name, location: org.location };
    });
    setDrafts(next);
  }, [organizations]);

  const handleAdd = () => {
    if (!newName.trim() || !newLocation.trim()) return;
    if (orgCount >= orgLimit) return;
    onAdd(newName.trim(), newLocation.trim());
    setNewName("");
    setNewLocation("");
  };

  const rows = useMemo(() => {
    return organizations.map((org) => {
      const draft = drafts[org.id] ?? { name: org.name, location: org.location };
      const isDirty =
        draft.name.trim() !== org.name || draft.location.trim() !== org.location;
      return { org, draft, isDirty };
    });
  }, [organizations, drafts]);

  return (
    <section className="panel org-page">
      <div className="panel-header">
        <h2>Organizations</h2>
        <p className="muted">Manage all organizations, update names, and locations.</p>
      </div>

      <div className="org-add">
        <input
          type="text"
          placeholder="Organization name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          disabled={isBusy || orgCount >= orgLimit}
        />
        <input
          type="text"
          placeholder="Location"
          value={newLocation}
          onChange={(event) => setNewLocation(event.target.value)}
          disabled={isBusy || orgCount >= orgLimit}
        />
        <button
          className="btn solid"
          type="button"
          onClick={handleAdd}
          disabled={isBusy || orgCount >= orgLimit}
        >
          {orgCount >= orgLimit
            ? "Organization limit reached"
            : busyActionId === "org-add"
              ? "Adding..."
              : "Add organization"}
        </button>
        <p className="muted">
          {orgCount} of {orgLimit} organizations used for this plan.
        </p>
      </div>

      <div className="org-table">
        <div className="org-head">
          <span>Name</span>
          <span>Location</span>
          <span>Staff</span>
          <span>Actions</span>
        </div>
        {rows.map(({ org, draft, isDirty }) => (
          <div className="org-row" key={org.id}>
            <input
              type="text"
              value={draft.name}
              onChange={(event) =>
                setDrafts((prev) => ({
                  ...prev,
                  [org.id]: { ...prev[org.id], name: event.target.value }
                }))
              }
              disabled={isBusy}
            />
            <input
              type="text"
              value={draft.location}
              onChange={(event) =>
                setDrafts((prev) => ({
                  ...prev,
                  [org.id]: { ...prev[org.id], location: event.target.value }
                }))
              }
              disabled={isBusy}
            />
            <span className="org-count">{org.staff.length}</span>
            <div className="org-actions">
              <button
                className="btn solid"
                type="button"
                onClick={() => onUpdate(org.id, draft.name.trim(), draft.location.trim())}
                disabled={!isDirty || isBusy}
              >
                {busyActionId === `org-save-${org.id}` ? "Saving..." : "Save"}
              </button>
              <button
                className="btn ghost danger"
                type="button"
                onClick={() => onRemove(org.id)}
                disabled={isBusy}
              >
                {busyActionId === `org-remove-${org.id}` ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default OrganizationsPage;
