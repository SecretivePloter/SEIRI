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

  useEffect(() => {
    if (config.mode !== 'cycle') return;
    const timer = window.setInterval(() => {
      setActiveView((view) => view === 'calendar' ? 'timeline' : 'calendar');
    }, config.interval * 1000);
    return () => window.clearInterval(timer);
  }, [config.mode, config.interval]);

  const view = config.mode === 'single' ? config.view : activeView;
  const source = view === 'calendar'
    ? 'https://app.ichikara.co.id/display-source?view=month'
    : 'https://edukasi.ichikara.co.id/display-source?view=today';

  return (
    <main className="h-screen w-screen overflow-hidden bg-background">
      <iframe
        key={view}
        title={view === 'calendar' ? 'Kalender interpreter' : 'Timeline sensei'}
        src={source}
        className="h-full w-full border-0"
        allow="fullscreen"
      />
    </main>
  );
}
