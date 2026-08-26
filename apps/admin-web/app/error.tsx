'use client';

export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}): React.JSX.Element {
  return (
    <main role="alert">
      <h1>Admin app could not start.</h1>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
