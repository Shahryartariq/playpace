import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found | Playpace',
  robots: { index: false },
};

/** For addresses outside every page, such as /something.php. Pages inside a language use [locale]/not-found. */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <main id="main" className="container not-found">
          <p className="not-found__code" aria-hidden="true">
            404
          </p>
          <h1 className="hero__title">This page doesn’t exist</h1>
          <p className="hero__lead">The link may be mistyped or out of date.</p>
          <p>
            <Link className="button button--primary" href="/">
              Go to the playlist calculator
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
