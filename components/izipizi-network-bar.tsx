export function IziPiziNetworkBar() {
  return (
    <a
      href="https://www.izipizi.lv/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Pārtikas sūtījumi caur izipizi.lv tīklu"
      className="group block bg-[#16202b] text-white transition hover:bg-[#1d2a39]"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-1.5 text-[12px] sm:gap-3 sm:px-6 lg:px-8">
        <span className="text-white/80">Pārtikas sūtījumi?</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/izipizi-logo.png"
          alt="izipizi.lv"
          className="h-7 w-auto sm:h-8"
          loading="lazy"
          decoding="async"
        />
        <span className="text-white/50 transition group-hover:text-white/80">↗</span>
      </div>
    </a>
  );
}
