import { useEffect, useMemo, useState } from 'react';

type DisplayView = 'calendar' | 'timeline';
type DisplayMode = 'cycle' | 'single';

function readConfig(): { mode: DisplayMode; view: DisplayView; interval: number } {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') === 'single' ? 'single' : 'cycle';
  const view = ['timeline', 'sensei'].includes(params.get('view') ?? '') ? 'timeline' : 'calendar';
  const requestedInterval = Number(params.get('interval'));
  const interval = Number.isFinite(requestedInterval) && requestedInterval > 0
    ? Math.min(600, Math.max(10, requestedInterval))
    : 30;
  return { mode, view, interval };
}

/** Public signage shell. Actual page content is rendered by each application's
 * existing page components, so their visual design remains the source of truth. */
export function DisplayPage() {
  const config = useMemo(readConfig, []);
  const [activeView, setActiveView] = useState<DisplayView>(config.view);
  const [outgoingView, setOutgoingView] = useState<DisplayView | null>(null);
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'prepare' | 'sliding'>('idle');

  useEffect(() => {
    if (config.mode !== 'cycle' || transitionPhase !== 'idle') return;

    const timer = window.setTimeout(() => {
      const nextView = activeView === 'calendar' ? 'timeline' : 'calendar';
      setOutgoingView(activeView);
      setActiveView(nextView);
      setTransitionPhase('prepare');
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setTransitionPhase('sliding'));
      });
    }, config.interval * 1000);
    return () => window.clearTimeout(timer);
  }, [activeView, config.mode, config.interval, transitionPhase]);

  useEffect(() => {
    if (transitionPhase !== 'sliding') return;

    const timer = window.setTimeout(() => {
      setTransitionPhase('idle');
      setOutgoingView(null);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [transitionPhase]);

  const views: DisplayView[] = config.mode === 'cycle'
    ? ['calendar', 'timeline']
    : [config.view];

  const sourceFor = (view: DisplayView) => view === 'calendar'
    ? 'https://interpretasync.vercel.app/display-source?view=month'
    : 'https://edukasi.ichikara.co.id/display-source?view=today';

  const positionClass = (view: DisplayView) => {
    if (transitionPhase === 'sliding') {
      return view === outgoingView ? '-translate-x-full' : 'translate-x-0';
    }
    if (transitionPhase === 'prepare') {
      return view === outgoingView ? 'translate-x-0' : 'translate-x-full';
    }
    return view === activeView ? 'translate-x-0' : 'translate-x-full';
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      {views.map((view) => (
        <iframe
          key={view}
          title={view === 'calendar' ? 'Kalender interpreter' : 'Timeline sensei'}
          src={sourceFor(view)}
          aria-hidden={view !== activeView}
          className={`absolute inset-0 h-full w-full border-0 ${positionClass(view)} ${
            transitionPhase === 'sliding'
              ? 'transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none'
              : 'transition-none'
          }`}
          allow="fullscreen"
        />
      ))}
    </main>
  );
}
