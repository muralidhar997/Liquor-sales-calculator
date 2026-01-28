import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "Liquor Audit",
  description: "Liquor store daily audit app"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold">
              {process.env.NEXT_PUBLIC_APP_NAME ?? "Liquor Audit"}
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link className="hover:underline" href="/user">User</Link>
              <Link className="hover:underline" href="/admin">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
