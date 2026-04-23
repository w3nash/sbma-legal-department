import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "./components/AuthProvider";
import { QueryProvider } from "./components/QueryProvider";
import { AppSidebar } from "./components/AppSidebar";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        image: session.user.image,
      }
    : null;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <body>
        <ThemeProvider>
          <AuthProvider user={user}>
            <QueryProvider>
              <AppSidebar />
              <main className="flex-1 p-6">{children}</main>
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
