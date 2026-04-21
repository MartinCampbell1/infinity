export default function ExecutionLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6">
        <div className="h-3 w-36 rounded-full bg-white/10" />
        <div className="mt-6 space-y-3">
          <div className="h-12 rounded-[18px] bg-white/[0.04]" />
          <div className="h-24 rounded-[18px] bg-white/[0.03]" />
          <div className="h-24 rounded-[18px] bg-white/[0.03]" />
        </div>
        <div className="mt-4 text-sm text-white/46">Loading execution surface...</div>
      </div>
    </main>
  );
}
