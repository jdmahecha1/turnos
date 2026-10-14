import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-brand-700 text-sm font-semibold">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">No encontramos esta página</h1>
      <p className="mt-2 text-stone-600">
        Revisa la dirección. Si buscabas un negocio, pídele el enlace correcto.
      </p>
      <Link href="/" className="btn-primary mt-6">
        Ir al inicio
      </Link>
    </div>
  );
}
