import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "CallCrew Assistant - Your First AI Employee",
  description:
    "Stop missing calls. CallCrew answers your business calls, captures lead info, and sends you a summary by text or email. Forward calls when you're busy, after hours, or all day.",
  openGraph: {
    title: "CallCrew Assistant - Your First AI Employee",
    description:
      "Stop missing calls. CallCrew answers your business calls, captures lead info, and sends you a summary by text or email.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
