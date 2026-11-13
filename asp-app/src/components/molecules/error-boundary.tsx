"use client"

import { Component, type ReactNode } from "react"

type ErrorBoundaryProps = {
  /** Tampilan saat anak komponen gagal dirender atau gagal memuat. */
  fallback: ReactNode
  children: ReactNode
}

type ErrorBoundaryState = { failed: boolean }

/**
 * Menangkap kegagalan render di bawahnya (mis. berkas data gagal dimuat saat offline)
 * agar hanya bagian itu yang diganti `fallback`, bukan seluruh halaman. Detail error
 * sengaja tidak ditampilkan maupun dicatat: bisa memuat data pribadi.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
