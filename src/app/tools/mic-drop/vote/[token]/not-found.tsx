/** A Guest Link with no Poll behind it: a mistyped or stale link. */
export default function NoSuchPoll() {
  return (
    <div className="md-notice">
      <h1>No such Poll</h1>
      <p>
        There&apos;s no Mic Drop vote at this link. Check you copied the whole link from the
        group chat, or ask the Host to share it again.
      </p>
    </div>
  );
}
