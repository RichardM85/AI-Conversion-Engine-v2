function BigRedButton({ children, onClick, disabled }) {
  return (
    <button
      className="big-red-button"
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="big-red-button-top" />
      <span className="big-red-button-face">
        <span className="big-red-button-label">{children}</span>
      </span>
    </button>
  );
}

export default BigRedButton;
