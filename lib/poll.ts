// setInterval yang berhenti saat tab tidak terlihat (hemat invocation/CPU Vercel)
// dan langsung refresh sekali begitu tab kembali aktif.
export function visiblePoll(fn: () => void, ms: number): () => void {
  const tick = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    fn();
  };
  const id = setInterval(tick, ms);
  const onVisible = () => { if (!document.hidden) fn(); };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
