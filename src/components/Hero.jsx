import BigRedButton from "./BigRedButton";

function Hero({ url, setUrl, isLoading, onAnalyze }) {
  return (
    <div className="hero-card">
      <div className="hero-layout">
        <div className="hero-copy-column">
          <div className="eyebrow">Decision Tool</div>
          <h1>Eine Seite rein. Eine klare Conversion-Entscheidung raus.</h1>
          <p className="hero-copy">
            Dieses Mini-Tool gibt keine zehn To-dos aus. Es zeigt dir genau den
            einen Hebel, den du als NÃ¤chstes bewegen solltest.
          </p>

          <div className="hero-points" aria-hidden="true">
            <span className="hero-point">1 URL rein</span>
            <span className="hero-point">1 Hebel raus</span>
            <span className="hero-point">2 Sekunden Fokus</span>
          </div>
        </div>

        <div className="hero-action-column">
          <label className="field-label" htmlFor="product-url">
            Produktseiten-URL
          </label>

          <input
            id="product-url"
            className="url-input"
            type="url"
            placeholder="https://deine-marke.de/produkt"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />

          <BigRedButton onClick={onAnalyze} disabled={isLoading}>
            {isLoading ? "Analysiere..." : "KLICK MICH!"}
          </BigRedButton>

          <div className="micro-copy">
            Mock-Analyse mit 2 Sekunden Delay. Fokus: nur eine Entscheidung.
          </div>
        </div>
      </div>
    </div>
  );
}

export default Hero;
