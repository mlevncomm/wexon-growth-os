"use client";

export function ConnectGuide({
  title,
  kicker,
  steps,
  copyValue,
}: {
  title: string;
  kicker?: string;
  steps: Array<{ title: string; body: string }>;
  copyValue?: string;
}) {
  return (
    <section className="card panel guide-card">
      <div className="panel-head">
        <div>
          <div className="page-kicker">{kicker ?? "Kılavuz"}</div>
          <h2>{title}</h2>
        </div>
      </div>
      <ol className="guide-steps">
        {steps.map((s, i) => (
          <li key={s.title}>
            <b>
              <span>{i + 1}</span>
              {s.title}
            </b>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>
      {copyValue ? (
        <label className="field" style={{ marginTop: 12 }}>
          <span>Kopyalanacak adres</span>
          <input readOnly value={copyValue} onFocus={(e) => e.currentTarget.select()} />
        </label>
      ) : null}
    </section>
  );
}
