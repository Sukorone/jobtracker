/** Slow-drifting gradient blobs plus a grain layer — the app's signature backdrop. */
export function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="bg__blob bg__blob--1" />
      <div className="bg__blob bg__blob--2" />
      <div className="bg__blob bg__blob--3" />
      <div className="bg__blob bg__blob--4" />
      <div className="bg__grain" />
    </div>
  );
}
