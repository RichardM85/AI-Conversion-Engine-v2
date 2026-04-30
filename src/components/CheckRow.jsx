function CheckRow({ label, status }) {
  const statusClass = status === "Problem" ? "is-problem" : "is-warning";

  return (
    <div className="check-row">
      <span className="check-label">{label}</span>
      <span className={`check-status ${statusClass}`}>{status}</span>
    </div>
  );
}

export default CheckRow;
