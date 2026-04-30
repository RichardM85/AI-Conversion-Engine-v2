import CheckRow from "./CheckRow";

function ResultCard({ result }) {
  return (
    <article className="result-card">
      <div className="result-head">
        <span className="result-badge">Klare Empfehlung</span>
        <h2>{result.title}</h2>
        <p className="result-subtitle">{result.subtitle}</p>
        <p className="result-explanation">{result.explanation}</p>
      </div>

      <section className="result-section">
        <h3>Checks</h3>
        <div className="check-list">
          {result.checks.map((check) => (
            <CheckRow
              key={check.label}
              label={check.label}
              status={check.status}
            />
          ))}
        </div>
      </section>

      <section className="result-section accent-section">
        <h3>Konkrete Handlung</h3>
        <p>{result.action}</p>
      </section>

      <section className="result-section example-grid">
        <div className="example-card">
          <span className="example-label">Statt</span>
          <strong>{result.example.from}</strong>
        </div>
        <div className="example-card example-card-better">
          <span className="example-label">Besser</span>
          <strong>{result.example.to}</strong>
        </div>
      </section>

      <section className="impact-row">
        <div>
          <span className="impact-label">Impact</span>
          <p>{result.impact}</p>
        </div>
        <button className="secondary-button" type="button">
          Nächsten Hebel anzeigen
        </button>
      </section>
    </article>
  );
}

export default ResultCard;
