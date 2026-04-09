'use client';
import Script from 'next/script';
import { usePathname } from 'next/navigation';

// Loads the Rezolv support widget only on public/customer pages.
// Hidden on agent store pages, sub-agent pages, and public shop pages.
export default function RezolvWidget() {
  const pathname = usePathname() || '';
  if (
    pathname.startsWith('/subagent') ||
    pathname.startsWith('/subshop') ||
    pathname.startsWith('/shop') ||
    pathname.startsWith('/store')
  ) {
    return null;
  }
  return (
    <>
      <Script id="rezolv-config" strategy="lazyOnload">
        {`window.REZOLV_CONFIG = { apiKey: "rzlv_22c149e96a8e3fb9d632e0fc6cdf631555c8d7b0b674cd4948565729e0eec468" };`}
      </Script>
      <Script src="https://api.rezolv.dev/widget.js" strategy="lazyOnload" />
    </>
  );
}
