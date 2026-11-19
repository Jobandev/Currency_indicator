import { useEffect, useRef, type ReactNode } from 'react';

export default function ScrollReveal({ children }: { children: ReactNode }) {
  const section = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = section.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.dataset.entered = 'true';
        observer.disconnect();
      },
      { threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="rw-reveal" ref={section}>
      {children}
    </div>
  );
}
