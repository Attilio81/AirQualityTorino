import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyState from '../../components/EmptyState'

describe('EmptyState', () => {
  it('shows default message', () => {
    render(<EmptyState />)
    expect(screen.getByText(/nessun dato/i)).toBeInTheDocument()
  })
  it('shows custom message', () => {
    render(<EmptyState message="Nessun dato nel periodo selezionato" />)
    expect(screen.getByText('Nessun dato nel periodo selezionato')).toBeInTheDocument()
  })
})
