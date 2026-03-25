import type { Organization } from "../types";

type Props = {
  organizations: Organization[];
  selectedOrgId: string;
  onSelect: (value: string) => void;
};

const OrgSelector = ({ organizations, selectedOrgId, onSelect }: Props) => {
  return (
    <div className="org-select">
      <label htmlFor="org">Organization</label>
      <select
        id="org"
        value={selectedOrgId}
        onChange={(event) => onSelect(event.target.value)}
        disabled={organizations.length === 0}
      >
        {organizations.length === 0 ? (
          <option value="">No organizations</option>
        ) : (
          organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
};

export default OrgSelector;
