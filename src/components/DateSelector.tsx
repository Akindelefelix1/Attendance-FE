type Props = {
  selectedDate: string;
  onChange: (value: string) => void;
  label?: string;
  hideLabel?: boolean;
};

const DateSelector = ({
  selectedDate,
  onChange,
  label = "Attendance date",
  hideLabel = false
}: Props) => {
  return (
    <div className="date-select">
      {hideLabel ? null : <label htmlFor="attendance-date">{label}</label>}
      <input
        id="attendance-date"
        type="date"
        value={selectedDate}
        onChange={(event) => onChange(event.target.value)}
        aria-label={hideLabel ? label : undefined}
      />
    </div>
  );
};

export default DateSelector;
