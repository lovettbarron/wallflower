import type { Metadata } from "next";
import "./globals.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/600.css";
import { Providers } from "@/components/providers";
<<<<<<< HEAD
import { Toaster } from "@/components/ui/sonner";
=======
import { TransportBar } from "@/components/transport/TransportBar";
>>>>>>> worktree-agent-a82adea1

export const metadata: Metadata = {
  title: "Wallflower",
  description: "Jam and sample manager for musicians",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body
        className="min-h-screen"
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          background: "#151921",
          color: "#E2E4E8",
        }}
      >
        <Providers>
<<<<<<< HEAD
          {children}
          <Toaster />
=======
          <div className="pb-14">
            {children}
          </div>
          <TransportBar />
>>>>>>> worktree-agent-a82adea1
        </Providers>
      </body>
    </html>
  );
}
