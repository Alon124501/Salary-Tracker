import { Children, cloneElement, useCallback, useEffect, useRef, useState } from 'react';

const STEP = 160;

export default function ScrollTabs({ children, activeIndex }) {
  const containerRef = useRef(null);
  const itemRefs = useRef([]);
  const [canScrollToStart, setCanScrollToStart] = useState(false);
  const [canScrollToEnd, setCanScrollToEnd] = useState(false);

  const items = Children.toArray(children);

  const updateEdges = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollToStart(el.scrollLeft < -2);
    setCanScrollToEnd(el.scrollLeft > -max + 2);
  }, []);

  useEffect(() => {
    updateEdges();
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
    };
  }, [updateEdges, items.length]);

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeIndex]);

  function scrollByStep(dir) {
    containerRef.current?.scrollBy({ left: dir * STEP, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      {canScrollToStart && (
        <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pe-0.5"
          style={{ background: 'linear-gradient(to left, transparent, rgba(248,250,252,0.9) 60%)' }}>
          <button type="button" onClick={() => scrollByStep(1)} aria-label="גלול לתחילת הכרטיסיות"
            className="w-7 h-7 rounded-full bg-white shadow flex items-center justify-center text-slate-500 active:scale-90 transition-transform">
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        </div>
      )}
      <div ref={containerRef} className="flex gap-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {items.map((child, i) => cloneElement(child, {
          key: child.key ?? i,
          ref: el => { itemRefs.current[i] = el; },
        }))}
      </div>
      {canScrollToEnd && (
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center ps-0.5"
          style={{ background: 'linear-gradient(to right, transparent, rgba(248,250,252,0.9) 60%)' }}>
          <button type="button" onClick={() => scrollByStep(-1)} aria-label="גלול להמשך הכרטיסיות"
            className="w-7 h-7 rounded-full bg-white shadow flex items-center justify-center text-slate-500 active:scale-90 transition-transform">
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>
        </div>
      )}
    </div>
  );
}
