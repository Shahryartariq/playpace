import { notFound } from 'next/navigation';

/** Any other path inside a language is a 404 with that language's layout. */
export default function CatchAll() {
  notFound();
}
