import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

const PX = "'Press Start 2P', monospace";
const BODY = "'Courier New', Courier, monospace";

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0a0a",
            padding: "32px",
            gap: "20px",
            fontFamily: BODY,
          }}
        >
          <div
            style={{
              fontFamily: PX,
              fontSize: "9px",
              color: "#dc1e1e",
              letterSpacing: "3px",
              textAlign: "center",
            }}
          >
            CREATIVE OVERRULED
          </div>

          <div
            style={{
              fontSize: "14px",
              color: "#888",
              maxWidth: "480px",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            The app hit an unexpected error. Your universe data is safe in local storage — reload to get back in the chair.
          </div>

          <div
            style={{
              fontFamily: BODY,
              fontSize: "11px",
              color: "#444",
              maxWidth: "480px",
              textAlign: "center",
              wordBreak: "break-word",
            }}
          >
            {this.state.error.message}
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "4px",
              fontFamily: PX,
              fontSize: "7px",
              background: "#dc1e1e",
              border: "1px solid #b01818",
              padding: "10px 22px",
              cursor: "pointer",
              color: "#fff",
              letterSpacing: "1px",
              borderRadius: "3px",
            }}
          >
            RELOAD APP
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
