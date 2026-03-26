import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { PublicDisposableAttendanceForm } from "../types";
import {
  getPublicDisposableAttendanceForm,
  submitPublicDisposableAttendanceResponse
} from "../lib/api";
import { formatDateLong } from "../lib/time";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const PublicDisposableCheckInPage = () => {
  const { publicId = "" } = useParams();
  const [attendance, setAttendance] = useState<PublicDisposableAttendanceForm | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "archived" | "error">("loading");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [responseCount, setResponseCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleLabel = useMemo(() => {
    if (!attendance) return "Event check-in";
    return attendance.title;
  }, [attendance]);

  useEffect(() => {
    const load = async () => {
      if (!publicId) {
        setStatus("not-found");
        return;
      }
      setError("");
      setStatus("loading");
      try {
        const item = await getPublicDisposableAttendanceForm(publicId);
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
        setResponseCount(0);
        setStatus("ready");
      } catch (loadError) {
        const message = getErrorMessage(loadError, "Could not load public check-in form.");
        if (/not found/i.test(message)) {
          setStatus("not-found");
          return;
        }
        setError(message);
        setStatus("error");
      }
    };
    void load();
  }, [publicId]);

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

    try {
      setIsSubmitting(true);
      await submitPublicDisposableAttendanceResponse({
        publicId: attendance.publicId,
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
      setResponseCount((prev) => prev + 1);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Could not submit check-in."));
    } finally {
      setIsSubmitting(false);
    }
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

  if (status === "error") {
    return (
      <main className="public-checkin-shell">
        <section className="public-checkin-card">
          <h1>Unable to load check-in form</h1>
          <p className="auth-error">{error || "Something went wrong."}</p>
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

          <button className="btn solid" type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit check-in"}
          </button>
        </div>
      </section>
    </main>
  );
};

export default PublicDisposableCheckInPage;
