import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";
<<<<<<< HEAD
import { Toaster } from "@/components/ui/sonner";
=======
import { TransportBar } from "@/components/transport/TransportBar";
>>>>>>> worktree-agent-a82adea1

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <body
        className="min-h-screen"
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
