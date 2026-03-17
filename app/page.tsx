const checks = [
  "Webhook URL points to /api/webhook/green",
  "Webhook token matches WEBHOOK_SECRET",
  "GREEN_BASE / GREEN_INSTANCE / GREEN_TOKEN are valid",
  "Mongo URI is configured in Vercel",
];

const flows = [
  "1 -> Service -> Barber -> Date -> Time -> Name -> Confirm",
  "6 -> List active appointments -> cancel <number>",
  "5 -> Human handoff + admin notification",
  "0 or menu/hi -> reset to main menu",
];

export default function Home() {
  return (
    <main className="ops-shell">
      <section className="hero">
        <p className="chip">WhatsApp Booking Bot</p>
        <h1>Luxury Tech Chatbot</h1>
        <p>
          Production-ready webhook bot for appointment booking, cancellation, and
          human handoff. This page is your quick operations view.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Endpoint</h2>
          <code>/api/webhook/green</code>
          <p>Receives Green API incoming messages and returns automated replies.</p>
        </article>

        <article className="card">
          <h2>Environment</h2>
          <code>.env.local + Vercel Project Variables</code>
          <p>Keep local and deployed keys aligned to avoid silent webhook failures.</p>
        </article>

        <article className="card">
          <h2>Health Checks</h2>
          <ul>
            {checks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Conversation Flows</h2>
          <ul>
            {flows.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
