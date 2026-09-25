import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GEOCE LabLicence — Alocação Inteligente de Hardware",
  description:
    "Sistema inteligente de alocação de hardware, filas FIFO, cotas justas (Fair Sharing) e métricas laboratoriais da UFC.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-[#0B0F17] text-slate-100 min-h-screen antialiased selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
