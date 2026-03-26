import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { DisposableAttendance } from "../types";
import {
  getDisposableAttendanceById,
  listDisposableAttendanceResponses,
  submitDisposableAttendanceResponse
} from "../lib/api";
import { formatDateLong } from "../lib/time";

const PublicDisposableCheckInPage = () => {
  const { attendanceId = "" } = useParams();
  const [attendance, setAttendance] = useState<DisposableAttendance | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "archived">("loading");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [responseCount, setResponseCount] = useState(0);

  const titleLabel = useMemo(() => {
    if (!attendance) return "Event check-in";
    return attendance.title;
  }, [attendance]);

  useEffect(() => {
    const load = async () => {
      if (!attendanceId) {
        setStatus("not-found");
        return;
      }
      setStatus("loading");
      const item = await getDisposableAttendanceById(attendanceId);
      if (!item) {
        setStatus("not-found");
        return;
      }
      if (item.isArchived) {
        setAttendance(item);
        setStatus("archived");
        return;
      }
      const initial: Record<string, string> = {};
      item.fields.forEach((field) => {
        initial[field.id] = "";
      });
      setValues(initial);
      setAttendance(item);
      const responses = await listDisposableAttendanceResponses(item.id);
      setResponseCount(responses.length);
      setStatus("ready");
    };
    void load();
  }, [attendanceId]);

  const handleSubmit = async () => {
    if (!attendance) return;
    setError("");
    setSuccessMessage("");

    for (const field of attendance.fields) {
      const nextValue = values[field.id]?.trim() ?? "";
      if (field.required && !nextValue) {
        setError(`Please provide ${field.label}.`);
        return;
      }
    }

    await submitDisposableAttendanceResponse({
      attendanceId: attendance.id,
      values: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value.trim()])
      )
    });

    const cleared: Record<string, string> = {};
    attendance.fields.forEach((field) => {
      cleared[field.id] = "";
    });
    setValues(cleared);
    setSuccessMessage("Check-in submitted successfully.");

    const responses = await listDisposableAttendanceResponses(attendance.id);
    setResponseCount(responses.length);
  };

  if (status === "loading") {
    return (
      <main className="public-checkin-shell">
        <section className="public-checkin-card">
          <h1>Loading check-in...</h1>
          <p className="muted">Please wait while we prepare the attendance form.</p>
        </section>
      </main>
    );
  }

  if (status === "not-found") {
    return (
      <main className="public-checkin-shell">
        <section className="public-checkin-card">
          <h1>Check-in form not found</h1>
          <p className="muted">This attendance link may be invalid or removed.</p>
          <Link className="btn ghost" to="/login">
            Go to login
          </Link>
        </section>
      </main>
    );
  }

  if (status === "archived") {
    return (
      <main className="public-checkin-shell">
        <section className="public-checkin-card">
          <h1>{titleLabel}</h1>
          <p className="muted">This attendance form is no longer accepting responses.</p>
          <Link className="btn ghost" to="/login">
            Back to site
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="public-checkin-shell">
      <section className="public-checkin-card">
        <div className="public-checkin-header">
          <h1>{attendance?.title}</h1>
          <p className="muted">
            {attendance?.eventDateISO ? formatDateLong(attendance.eventDateISO) : ""}
          </p>
          {attendance?.description ? <p>{attendance.description}</p> : null}
          {attendance?.location ? <p className="muted">Location: {attendance.location}</p> : null}
          <span className="pill">Responses: {responseCount}</span>
        </div>

        <div className="public-checkin-form">
          {attendance?.fields.map((field) => (
            <label key={field.id}>
              {field.label}
              <input
                type={field.type === "email" ? "email" : "text"}
                value={values[field.id] ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.id]: event.target.value
                  }))
                }
                placeholder={`Enter ${field.label.toLowerCase()}`}
              />
            </label>
          ))}

          {error ? <p className="auth-error">{error}</p> : null}
          {successMessage ? <p className="public-success">{successMessage}</p> : null}

          <button className="btn solid" type="button" onClick={handleSubmit}>
            Submit check-in
          </button>
        </div>
      </section>
    </main>
  );
};

export default PublicDisposableCheckInPage;
