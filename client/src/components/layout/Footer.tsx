export default function Footer() {
  return (
    <footer className="border-t border-burgundy-900/30 bg-burgundy-950/45 py-8 text-center text-xs tracking-wider text-lavender-300/50">
      <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <p>© 2026 KrewPlay • Cinematic Synchronized Watch Space By Krishna Kudre</p>
        <div className="flex gap-4">
          <span className="hover:text-lavender-400 transition-colors duration-300 cursor-default">
            Synchronized Playback
          </span>
          <span className="text-burgundy-700">•</span>
          <span className="hover:text-lavender-400 transition-colors duration-300 cursor-default">
            HD Streaming
          </span>
          <span className="text-burgundy-700">•</span>
          <span className="hover:text-lavender-400 transition-colors duration-300 cursor-default">
            Low Latency
          </span>
        </div>
      </div>
    </footer>
  );
}