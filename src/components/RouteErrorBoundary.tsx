import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("Route error:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div>
            <h2 className="text-xl font-semibold text-foreground">Đã xảy ra lỗi khi hiển thị trang</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {this.state.error?.message || "Vui lòng thử lại hoặc tải lại trang."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.handleReset}>Thử lại</Button>
            <Button onClick={() => window.location.reload()}>Tải lại trang</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
