import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PasswordVisibilityToggle } from './PasswordVisibilityToggle'

describe('PasswordVisibilityToggle', () => {
  it('should render with correct initial state', () => {
    const mockOnToggle = vi.fn()
    
    render(
      <PasswordVisibilityToggle
        isVisible={false}
        onToggle={mockOnToggle}
      />
    )
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('title', 'Show password')
    expect(button).toHaveAttribute('aria-label', 'Show password')
  })

  it('should render with visible state', () => {
    const mockOnToggle = vi.fn()
    
    render(
      <PasswordVisibilityToggle
        isVisible={true}
        onToggle={mockOnToggle}
      />
    )
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('title', 'Hide password')
    expect(button).toHaveAttribute('aria-label', 'Hide password')
  })

  it('should call onToggle when clicked', () => {
    const mockOnToggle = vi.fn()
    
    render(
      <PasswordVisibilityToggle
        isVisible={false}
        onToggle={mockOnToggle}
      />
    )
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    expect(mockOnToggle).toHaveBeenCalledTimes(1)
  })

  it('should be disabled when disabled prop is true', () => {
    const mockOnToggle = vi.fn()
    
    render(
      <PasswordVisibilityToggle
        isVisible={false}
        onToggle={mockOnToggle}
        disabled={true}
      />
    )
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    
    fireEvent.click(button)
    expect(mockOnToggle).not.toHaveBeenCalled()
  })

  it('should apply custom className', () => {
    const mockOnToggle = vi.fn()
    
    render(
      <PasswordVisibilityToggle
        isVisible={false}
        onToggle={mockOnToggle}
        className="custom-class"
      />
    )
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })
})