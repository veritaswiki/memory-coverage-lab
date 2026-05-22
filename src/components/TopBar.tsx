export function TopBar() {
  return (
    <header className="topbar">
      <a className="site-wordmark" href="#top" aria-label="MemoryBench home">
        <span>MemoryBench</span>
        <b>/ai-memory-intelligence</b>
      </a>

      <nav className="site-nav" aria-label="主导航">
        <a href="#research">Research</a>
        <a href="#benchmarks">Benchmarks</a>
        <a href="#platform">Platform</a>
        <a href="#subscribe">Subscribe</a>
      </nav>

      <a className="login-link" href="#benchmarks">
        Explore data
      </a>
    </header>
  );
}
