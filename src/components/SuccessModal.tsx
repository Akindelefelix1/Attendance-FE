type Props = {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  closeLabel?: string;
  actionLink?: string;
  actionLabel?: string;
};

const SUCCESS_ICON_URL =
  "https://res.cloudinary.com/doxxevnyt/image/upload/v1663442512/checkbox_thusz3.png";

const SuccessModal = ({
  isOpen,
  title = "Success",
  message,
  onClose,
  closeLabel = "Done",
  actionLink,
  actionLabel = "Continue"
}: Props) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal success-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <img className="success-modal-icon" src={SUCCESS_ICON_URL} alt="Success" />
        <h3>{title}</h3>
        <p className="muted">{message}</p>
        <div className="modal-actions">
          {actionLink ? (
            <a
              className="btn ghost"
              href={actionLink}
              target="_blank"
              rel="noreferrer"
            >
              {actionLabel}
            </a>
          ) : null}
          <button className="btn solid" type="button" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessModal;
