import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean }

const RELOAD_KEY = '__chunk_reload_attempt__';

export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any): State {
    const msg = String(error?.message || error || '');
    const isChunkErr =
      /Importing a module script failed/i.test(msg) ||
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /Loading chunk \d+ failed/i.test(msg) ||
      /ChunkLoadError/i.test(msg);

    if (isChunkErr && typeof window !== 'undefined') {
      // Avoid infinite reload loop
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        return { hasError: true };
      }
    }
    return { hasError: true };
  }

  componentDidCatch() {}

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-screen items-center justify-center p-6 text-center">
            <div>
              <p className="font-semibold mb-2">Đã có lỗi tải trang.</p>
              <button
                className="text-primary underline"
                onClick={() => { sessionStorage.removeItem(RELOAD_KEY); window.location.reload(); }}
              >
                Tải lại
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
