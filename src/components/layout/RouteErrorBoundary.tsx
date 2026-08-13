// ErrorBoundary level route (NFR brief) — tangkap crash render per halaman,
// tampilkan fallback + reload, jangan biarkan seluruh app mati.

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error('RouteErrorBoundary:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-outline-variant" aria-hidden>
            cloud_off
          </span>
          <h2 className="font-headline-md text-headline-md text-on-surface">Halaman gagal dimuat</h2>
          <p className="max-w-md font-body-md text-body-md text-secondary">{this.state.error.message}</p>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            className="rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-container"
          >
            Muat ulang halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
