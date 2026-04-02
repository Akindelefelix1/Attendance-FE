import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { PublicDisposableAttendanceForm } from "../types";
import {
  getPublicDisposableAttendanceForm,
  submitPublicDisposableAttendanceResponse
} from "../lib/api";
import { formatDateLong, getTodayISO } from "../lib/time";
import SuccessModal from "./SuccessModal";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

type ToastState = {
  kind: "success" | "error";
  message: string;
};

const PublicDisposableCheckInPage = () => {
  const { publicId = "" } = useParams();
  const [attendance, setAttendance] = useState<PublicDisposableAttendanceForm | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "archived" | "error">("loading");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [responseCount, setResponseCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [eventDayFlow, setEventDayFlow] = useState<"checkin" | "register">("checkin");
  const [successModalMessage, setSuccessModalMessage] = useState<string>("");
  const [successModalActionLink, setSuccessModalActionLink] = useState<string>("");
  const [successModalActionLabel, setSuccessModalActionLabel] = useState<string>("");

  const titleLabel = useMemo(() => {
    if (!attendance) return "Event check-in";
    return attendance.title;
  }, [attendance]);

  const todayISO = getTodayISO();
  const isEventDay = attendance?.eventDateISO === todayISO;
  const isBeforeEvent = attendance ? todayISO < attendance.eventDateISO : false;
  const preRegisterEnabled = Boolean(attendance?.allowPreRegister);
  const shouldUseEmailOnlyCheckIn =
    preRegisterEnabled && isEventDay && eventDayFlow === "checkin";

  const showToast = (kind: ToastState["kind"], message: string) => {
    setToast({ kind, message });
  };

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

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
        setEventDayFlow("checkin");
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
        showToast("error", message);
        setStatus("error");
      }
    };
    void load();
  }, [publicId]);

  const validateForAction = (action: "auto" | "preregister" | "checkin") => {
    if (!attendance) return false;

    const emailValue = (values.email ?? "").trim();
    const emailOnlyCheckIn = shouldUseEmailOnlyCheckIn && action === "checkin";

    if (emailOnlyCheckIn && !emailValue) {
      setError("Please provide Email.");
      return false;
    }

    for (const field of attendance.fields) {
      const nextValue = values[field.id]?.trim() ?? "";
      if (field.required && !nextValue) {
        if (emailOnlyCheckIn && field.id !== "email") {
          continue;
        }
        setError(`Please provide ${field.label}.`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (action: "auto" | "preregister" | "checkin" = "auto") => {
    if (!attendance) return;
    setError("");
    if (!validateForAction(action)) return;

    try {
      setIsSubmitting(true);
      const result = await submitPublicDisposableAttendanceResponse({
        publicId: attendance.publicId,
        action,
        values: Object.fromEntries(
          Object.entries(values).map(([key, value]) => [key, value.trim()])
        )
      });

      const submittedEmail = (values.email ?? "").trim();

      const cleared: Record<string, string> = {};
      attendance.fields.forEach((field) => {
        cleared[field.id] = "";
      });
      setValues(cleared);

      // After event-day walk-in registration, switch to email-only check-in flow.
      if (preRegisterEnabled && isEventDay && action === "preregister") {
        setEventDayFlow("checkin");
        setValues((prev) => ({
          ...prev,
          email: submittedEmail
        }));
      }

      setResponseCount((prev) => prev + 1);
      setSuccessModalMessage(result.message || "Check-in submitted successfully.");
      setSuccessModalActionLink(result.postSubmitActionLink || attendance.postSubmitActionLink || "");
      setSuccessModalActionLabel(
        result.postSubmitActionLabel || attendance.postSubmitActionLabel || "Take next action"
      );
    } catch (submitError) {
      const message = getErrorMessage(submitError, "Could not submit check-in.");
      setError(message);
      showToast("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <main className="public-checkin-shell">
        <section className="public-checkin-card">
          {toast ? (
            <div className={`toast-banner ${toast.kind}`} role="status" aria-live="polite">
              <span>{toast.message}</span>
              <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message">
                ×
              </button>
            </div>
          ) : null}
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
          {toast ? (
            <div className={`toast-banner ${toast.kind}`} role="status" aria-live="polite">
              <span>{toast.message}</span>
              <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message">
                ×
              </button>
            </div>
          ) : null}
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
          {toast ? (
            <div className={`toast-banner ${toast.kind}`} role="status" aria-live="polite">
              <span>{toast.message}</span>
              <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message">
                ×
              </button>
            </div>
          ) : null}
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
          {toast ? (
            <div className={`toast-banner ${toast.kind}`} role="status" aria-live="polite">
              <span>{toast.message}</span>
              <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message">
                ×
              </button>
            </div>
          ) : null}
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
        {toast ? (
          <div className={`toast-banner ${toast.kind}`} role="status" aria-live="polite">
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss message">
              ×
            </button>
          </div>
        ) : null}
        <div className="public-checkin-header">
          <h1>{attendance?.title}</h1>
          <p className="muted">
            {attendance?.eventDateISO ? formatDateLong(attendance.eventDateISO) : ""}
          </p>
          {attendance?.description ? <p>{attendance.description}</p> : null}
          {attendance?.location ? <p className="muted">Location: {attendance.location}</p> : null}
          {preRegisterEnabled ? (
            <p className="muted">
              {isBeforeEvent
                ? "Pre-registration is open now. Return on event day to complete check-in."
                : isEventDay
                  ? eventDayFlow === "checkin"
                    ? "Event day check-in is live. If you already pre-registered, enter only your email to check in."
                    : "Walk-in attendee? Fill this form to register now."
                  : "Event date has passed."}
            </p>
          ) : null}
          <span className="pill">Responses: {responseCount}</span>
        </div>

        <div className="public-checkin-form">
          {preRegisterEnabled && isEventDay ? (
            <div className="disposable-filters">
              <button
                type="button"
                className={`filter-pill ${eventDayFlow === "checkin" ? "active" : ""}`}
                onClick={() => setEventDayFlow("checkin")}
                disabled={isSubmitting}
              >
                I pre-registered
              </button>
              <button
                type="button"
                className={`filter-pill ${eventDayFlow === "register" ? "active" : ""}`}
                onClick={() => setEventDayFlow("register")}
                disabled={isSubmitting}
              >
                I need to register
              </button>
            </div>
          ) : null}

          {shouldUseEmailOnlyCheckIn ? (
            <label>
              Email
              <input
                type="email"
                value={values.email ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    email: event.target.value
                  }))
                }
                placeholder="Enter your email"
              />
            </label>
          ) : (
            attendance?.fields.map((field) => (
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
            ))
          )}

          {error ? <p className="auth-error">{error}</p> : null}

          {preRegisterEnabled ? (
            <div className="disposable-actions">
              <button
                className="btn ghost"
                type="button"
                onClick={() => handleSubmit("preregister")}
                disabled={isSubmitting || (!isBeforeEvent && !(isEventDay && eventDayFlow === "register"))}
              >
                {isSubmitting && (isBeforeEvent || (isEventDay && eventDayFlow === "register"))
                  ? "Submitting..."
                  : isEventDay
                    ? "Register now"
                    : "Pre-register"}
              </button>
              <button
                className="btn solid"
                type="button"
                onClick={() => handleSubmit("checkin")}
                disabled={isSubmitting || !isEventDay || eventDayFlow !== "checkin"}
              >
                {isSubmitting && isEventDay ? "Submitting..." : "Check in"}
              </button>
            </div>
          ) : (
            <button className="btn solid" type="button" onClick={() => handleSubmit("auto")} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit check-in"}
            </button>
          )}
        </div>
      </section>

      <SuccessModal
        isOpen={Boolean(successModalMessage)}
        title="Success"
        message={successModalMessage}
        actionLink={successModalActionLink || undefined}
        actionLabel={successModalActionLabel || "Take next action"}
        onClose={() => {
          setSuccessModalMessage("");
          setSuccessModalActionLink("");
          setSuccessModalActionLabel("");
        }}
      />
    </main>
  );
};

export default PublicDisposableCheckInPage;
