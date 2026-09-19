import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ViewTransitionAgent } from "@/components/ViewTransitionAgent";
import "./globals.css";

export const metadata: Metadata = {
  title: "prompt/studio — prompt engineering workbench",
  description:
    "A prompt engineering studio: tag prompt blocks, group them into stacks, mix them in the rack, and publish compositions.",
  icons: { icon: "/favicon.svg" },
};

const themeBootstrap = `
(function(){
  var read = function(key, fallback){
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      try { return JSON.parse(raw); } catch (e) { return raw; }
    } catch (e) { return fallback; }
  };
  document.documentElement.setAttribute('data-theme', read('ps.theme', 'light'));
  document.documentElement.setAttribute('data-radius', read('ps.radius', 'rounded'));
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen antialiased">
        <ViewTransitionAgent />
        {children}
      </body>
    </html>
  );
}
