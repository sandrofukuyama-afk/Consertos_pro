export default function Loading() {
  return (
    <div className="min-h-screen w-full px-4 py-4 md:px-5 flex flex-col justify-center items-center bg-[var(--background)]">
      <div className="relative flex flex-col items-center p-8 rounded-[30px] border border-white/10 bg-[var(--panel)]/60 backdrop-blur-md shadow-[0_24px_64px_rgba(0,0,0,0.35)] max-w-sm w-full">
        {/* Subtle glowing background effect */}
        <div className="absolute inset-0 rounded-[30px] bg-linear-to-br from-[rgba(184,109,60,0.12)] to-transparent pointer-events-none" />
        
        {/* Animated Glowing Ring */}
        <div className="relative flex items-center justify-center h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-white/5" />
          <div className="absolute inset-0 rounded-full border-4 border-t-[var(--accent-copper)] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-2 rounded-full border border-white/10 bg-white/2" />
        </div>

        <h3 className="mt-6 font-[family-name:var(--font-heading)] text-lg font-semibold text-white tracking-tight text-center">
          Carregando bancada...
        </h3>
        <p className="mt-2 text-xs text-[var(--muted)] text-center max-w-[200px]">
          Sincronizando com a memória técnica e banco de dados
        </p>

        {/* Skeleton Bars Simulation */}
        <div className="mt-6 w-full space-y-3">
          <div className="h-3 w-3/4 bg-white/5 rounded-full animate-pulse" />
          <div className="h-3 w-1/2 bg-white/5 rounded-full animate-pulse" />
          <div className="h-3 w-5/6 bg-white/5 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
