import { Eye, EyeOff } from 'lucide-react'
import { Button } from 'ui'

interface PasswordVisibilityToggleProps {
  isVisible: boolean
  onToggle: () => void
  disabled?: boolean
  size?: 'tiny' | 'small' | 'medium' | 'large'
  className?: string
}

export const PasswordVisibilityToggle = ({
  isVisible,
  onToggle,
  disabled = false,
  size = 'tiny',
  className = '',
}: PasswordVisibilityToggleProps) => {
  return (
    <Button
      type="default"
      size={size}
      title={isVisible ? 'Hide password' : 'Show password'}
      aria-label={isVisible ? 'Hide password' : 'Show password'}
      icon={isVisible ? <EyeOff /> : <Eye />}
      disabled={disabled}
      onClick={onToggle}
      className={className}
    />
  )
}