"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Eye, RotateCcw } from "lucide-react";

/**
 * Checks whether WebGL is supported and available in the current browser session.
 * Tests WebGL 2.0 first, then WebGL 1.0.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return Boolean(window.WebGLRenderingContext && gl);
  } catch {
    return false;
  }
}

interface Spatial3DErrorBoundaryProps {
  children: ReactNode;
  onFallbackTo2D?: () => void;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface Spatial3DErrorBoundaryState {
  hasError: boolean;
  isContextLost: boolean;
  errorMessage?: string;
}

export class Spatial3DErrorBoundary extends Component<
  Spatial3DErrorBoundaryProps,
  Spatial3DErrorBoundaryState
> {
  private containerRef = React.createRef<HTMLDivElement>();

  constructor(props: Spatial3DErrorBoundaryProps) {
    super(props);
    // Pre-mount check
    const supported = isWebGLAvailable();
    this.state = {
      hasError: !supported,
      isContextLost: false,
      errorMessage: supported
        ? undefined
        : "WebGL is disabled or unsupported by your graphics hardware/driver.",
    };
  }

  static getDerivedStateFromError(error: Error): Spatial3DErrorBoundaryState {
    return {
      hasError: true,
      isContextLost: false,
      errorMessage: error.message || "Failed to initialize 3D canvas context.",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[SafeSpace 3D Isolation] Caught 3D spatial rendering failure:",
        error,
        errorInfo
      );
    }
  }

  componentDidMount(): void {
    const el = this.containerRef.current;
    if (el) {
      el.addEventListener("webglcontextlost", this.handleContextLost as EventListener);
    }
    window.addEventListener(
      "webglcontextlost",
      this.handleContextLost as EventListener
    );
  }

  componentWillUnmount(): void {
    const el = this.containerRef.current;
    if (el) {
      el.removeEventListener("webglcontextlost", this.handleContextLost as EventListener);
    }
    window.removeEventListener(
      "webglcontextlost",
      this.handleContextLost as EventListener
    );
  }

  private handleContextLost = (event: Event): void => {
    // Calling preventDefault tells the browser we handle context loss ourselves
    event.preventDefault();
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[SafeSpace 3D Isolation] WebGL context lost on canvas. Switching to fallback state."
      );
    }
    this.setState({
      hasError: true,
      isContextLost: true,
      errorMessage: "Graphics device context was lost or reset by the operating system.",
    });
  };

  private handleRetry = (): void => {
    if (!isWebGLAvailable()) {
      this.setState({
        hasError: true,
        isContextLost: false,
        errorMessage: "WebGL remains unavailable on this device.",
      });
      return;
    }
    this.setState({
      hasError: false,
      isContextLost: false,
      errorMessage: undefined,
    });
  };

  render(): ReactNode {
    const { hasError, isContextLost, errorMessage } = this.state;
    const {
      children,
      onFallbackTo2D,
      fallbackTitle = "3D view is unavailable on this device",
      fallbackMessage = "Spatial calculations, route clearances, and hazard analyses remain fully active in 2D Plan view.",
    } = this.props;

    if (hasError) {
      return (
        <div
          ref={this.containerRef}
          role="alert"
          aria-live="polite"
          className="flex h-full w-full flex-col items-center justify-center p-6 bg-[#f7f8f6] text-center select-none"
        >
          <div className="max-w-md w-full rounded-xl border border-[#cbd5e1] bg-white p-6 shadow-sm">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-[#fef3c7] text-[#d97706]">
              <AlertTriangle className="size-5 stroke-[2]" />
            </div>

            <h3 className="text-base font-bold text-[#192329]">
              {isContextLost ? "3D Graphics Context Interrupted" : fallbackTitle}
            </h3>

            <p className="mt-2 text-xs text-[#64748b] leading-relaxed">
              {fallbackMessage}
            </p>

            {errorMessage && (
              <p className="mt-2.5 rounded bg-slate-50 border border-slate-200 px-2 py-1 font-mono text-[11px] text-[#475569]">
                {errorMessage}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              {onFallbackTo2D && (
                <button
                  type="button"
                  onClick={onFallbackTo2D}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e7168] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#175b54] active:bg-[#124741] transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e7168]"
                >
                  <Eye className="size-3.5" />
                  <span>Continue in 2D Plan</span>
                </button>
              )}

              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-medium text-[#192329] hover:bg-[#f8fafc] active:bg-[#f1f5f9] transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e7168]"
              >
                <RotateCcw className="size-3.5" />
                <span>Retry 3D view</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div ref={this.containerRef} className="h-full w-full">
        {children}
      </div>
    );
  }
}
