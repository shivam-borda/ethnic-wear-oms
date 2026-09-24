import GlobalLoader from "@/components/layout/GlobalLoader";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aahman — Ethnic Wear Order Management",
  description:
    "Premium order management system for ethnic wear tailoring and customized clothing business.",
  keywords: "ethnic wear, tailoring, order management, kurta, koti, ERP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-background">
        <GlobalLoader />
        {children}
        <Toaster
          richColors
          position="top-right"
          theme="light"
          toastOptions={{
            style: {
              fontFamily: "Inter, sans-serif",
            },
          }}
        />
      </body>
    </html>
  );
}
