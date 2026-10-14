import Link from "next/link";

const DEMO_SLUG = "la-80";

const FEATURES = [
  {
    title: "Reservas 24/7",
    text: "Tus clientes eligen servicio, día y hora desde el celular. Sin llamadas ni mensajes.",
  },
  {
    title: "Cero citas cruzadas",
    text: "La base de datos garantiza que dos personas nunca reserven el mismo horario, ni siquiera al mismo segundo.",
  },
  {
    title: "Datos protegidos",
    text: "Solo tú ves los nombres y teléfonos de tus clientes. Cada negocio está aislado de los demás.",
  },
];

export default function Home() {
  return (
    <div className="space-y-16 py-6">
      <section className="mx-auto max-w-2xl text-center">
        <p className="bg-brand-100 text-brand-700 mb-4 inline-block rounded-full px-3 py-1 text-sm font-medium">
          Para barberías, spas, consultorios y más
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Que tus clientes reserven solos, a cualquier hora
        </h1>
        <p className="mt-4 text-lg text-balance text-stone-600">
          Crea la página de reservas de tu negocio en un minuto y compártela por WhatsApp o en tu
          Instagram.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/b/${DEMO_SLUG}`} className="btn-primary px-6 py-3 text-base">
            Probar una reserva
          </Link>
          <Link href="/login" className="btn-secondary px-6 py-3 text-base">
            Crear mi negocio
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-stone-600">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
