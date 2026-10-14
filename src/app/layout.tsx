import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Turnos · Reservas para tu negocio", template: "%s · Turnos" },
  description:
    "Tus clientes reservan su cita en línea, sin llamadas ni mensajes. Para barberías, spas, consultorios y más.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <span className="bg-brand-600 grid size-8 place-items-center rounded-lg text-white">
                T
              </span>
              Turnos
            </Link>
            <Link href="/panel" className="btn-secondary">
              Mi negocio
            </Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-stone-200 py-6 text-center text-sm text-stone-500">
          Turnos · Proyecto de código abierto ·{" "}
          <a className="underline hover:text-stone-800" href="https://github.com/jdmahecha1/turnos">
            GitHub
          </a>
        </footer>
      </body>
    </html>
  );
}
