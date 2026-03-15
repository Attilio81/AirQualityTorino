import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBanner from '../../components/ErrorBanner'

describe('ErrorBanner', () => {
  it('shows error message', () => {
    render(<ErrorBanner message="Errore di connessione" onRetry={() => {}} />)
    expect(screen.getByText(/errore di connessione/i)).toBeInTheDocument()
  })
  it('calls onRetry when button clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorBanner message="Errore" onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /riprova/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
