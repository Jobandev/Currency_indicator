import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api';
import { format } from './ui';

type Point = { date: string; rate: number };

export default function HistoryPreview() {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  useEffect(() => {
    if (!section.current) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      api<Point[]>('/history?pair=NZD%2FINR', { signal: controller.signal })
        .then((rows) => {
          if (!controller.signal.aborted)
            setPoints([...rows].sort((a, b) => a.date.localeCompare(b.date)));
        })
        .catch(() => {});
    });
    observer.observe(section.current);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, []);
  const values = points.map((point) => point.rate);
  const high = Math.max(...values);
  const low = Math.min(...values);
  useEffect(() => {
    const drawArea = canvas.current;
    if (!drawArea || points.length < 2) return;
    const context = drawArea.getContext('2d');
    if (!context) return;
    const { width, height } = drawArea;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = '#216449';
    context.lineWidth = 3;
    context.lineJoin = 'round';
    context.beginPath();
    const start = Date.parse(points[0].date);
    const duration = Math.max(1, Date.parse(points.at(-1)!.date) - start);
    points.forEach((point, index) => {
      const x = 6 + ((Date.parse(point.date) - start) / duration) * (width - 12);
      const y =
        high === low ? height / 2 : 6 + ((high - point.rate) / (high - low)) * (height - 12);
      if (index) context.lineTo(x, y);
      else context.moveTo(x, y);
    });
    context.stroke();
  }, [high, low, points]);
  return (
    <section ref={section} className="section" aria-labelledby="history-preview-heading">
      <h2 id="history-preview-heading">NZD to INR over the past month</h2>
      {points.length > 1 && (
        <>
          <canvas
            ref={canvas}
            className="history-preview"
            width={720}
            height={180}
            aria-hidden="true"
          />
          <p>
            The daily reference rate ranged from {format(low)} to {format(high)} INR across{' '}
            {points.length} observations.
          </p>
        </>
      )}
      <p>
        Daily reference rates from <a href="https://frankfurter.dev/">Frankfurter</a>.
      </p>
      <Link className="text-link" to="/charts">
        Explore historical exchange rates
      </Link>
    </section>
  );
}
