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

export interface Spatial3DErrorBoundaryProps {
  children: ReactNode;
  onFallbackTo2D?: () => void;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

export interface Spatial3DErrorBoundaryState {
  hasError: boolean;
  isContextLost: boolean;
  errorMessage?: string;
  retryKey: number;
}

export class Spatial3DErrorBoundary extends Component<
  Spatial3DErrorBoundaryProps,
  Spatial3DErrorBoundaryState
> {
  private containerRef = React.createRef<HTMLDivElement>();
  private _isMounted = false;

  constructor(props: Spatial3DErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      isContextLost: false,
      errorMessage: undefined,
      retryKey: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<Spatial3DErrorBoundaryState> {
    return {
      hasError: true,
      isContextLost: false,
      errorMessage: error.message || "Failed to initialize 3D canvas context.",
    };
  }

  static getDerivedStateFromContextLost(): Partial<Spatial3DErrorBoundaryState> {
    return {
      hasError: true,
      isContextLost: true,
      errorMessage: "Graphics device context was lost or reset by the operating system.",
    };
  }

  static getDerivedStateFromRetry(prevKey: number): Partial<Spatial3DErrorBoundaryState> {
    if (!isWebGLAvailable()) {
      return {
        hasError: true,
        isContextLost: false,
        errorMessage: "WebGL remains unavailable on this device.",
      };
    }
    return {
      hasError: false,
      isContextLost: false,
      errorMessage: undefined,
      retryKey: (prevKey || 0) + 1,
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
    this._isMounted = true;
    // Client-side pre-mount check (avoids SSR hydration mismatch)
    if (!isWebGLAvailable()) {
      this.setState({
        hasError: true,
        errorMessage: "WebGL is disabled or unsupported by your graphics hardware/driver.",
      });
    }

    const el = this.containerRef.current;
    if (el) {
      // Use capture: true because webglcontextlost does NOT bubble
      el.addEventListener(
        "webglcontextlost",
        this.handleContextLost as EventListener,
        true
      );
      el.addEventListener(
        "webglcontextrestored",
        this.handleContextRestored as EventListener,
        true
      );
    }
  }

  componentWillUnmount(): void {
    this._isMounted = false;
    const el = this.containerRef.current;
    if (el) {
      el.removeEventListener(
        "webglcontextlost",
        this.handleContextLost as EventListener,
        true
      );
      el.removeEventListener(
        "webglcontextrestored",
        this.handleContextRestored as EventListener,
        true
      );
    }
  }

  public handleContextLost = (event: Event): void => {
    const targetNode = event.target as Node | null;
    if (
      this.containerRef.current &&
      targetNode &&
      typeof this.containerRef.current.contains === "function" &&
      !this.containerRef.current.contains(targetNode)
    ) {
      return;
    }

    // Calling preventDefault informs the browser the app manages context restoration
    event.preventDefault();
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[SafeSpace 3D Isolation] WebGL context lost on canvas. Switching to fallback state."
      );
    }
    this.setState(
      Spatial3DErrorBoundary.getDerivedStateFromContextLost() as Spatial3DErrorBoundaryState
    );
  };

  public handleContextRestored = (event?: Event): void => {
    if (event?.target) {
      const targetNode = event.target as Node | null;
      if (
        this.containerRef.current &&
        targetNode &&
        typeof this.containerRef.current.contains === "function" &&
        !this.containerRef.current.contains(targetNode)
      ) {
        return;
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.info(
        "[SafeSpace 3D Isolation] WebGL context restored. Reconstructing 3D scene."
      );
    }
    this.handleRetry();
  };

  public handleRetry = (): void => {
    this.setState(
      (prev) =>
        Spatial3DErrorBoundary.getDerivedStateFromRetry(
          prev.retryKey
        ) as Spatial3DErrorBoundaryState
    );
  };

  render(): ReactNode {
    const { hasError, isContextLost, errorMessage, retryKey } = this.state;
    const {
      children,
      onFallbackTo2D,
      fallbackTitle = "3D view is unavailable on this device",
      fallbackMessage = "Spatial calculations, route clearances, and hazard analyses remain fully active in 2D Plan view.",
    } = this.props;

    return (
      <div ref={this.containerRef} className="h-full w-full">
        {hasError ? (
          <div
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
        ) : (
          <div
            key={`spatial-3d-renderer-subtree-${retryKey}`}
            className="h-full w-full"
          >
            {children}
          </div>
        )}
      </div>
    );
  }
}
