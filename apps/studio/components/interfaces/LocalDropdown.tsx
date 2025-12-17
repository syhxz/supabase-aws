import { ProfileImage } from 'components/ui/ProfileImage'
import { Command, FlaskConical, LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/router'

import { useIsLoggedIn } from 'common'
import { useSignOut } from 'lib/auth'
import { IS_PLATFORM } from 'lib/constants'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  singleThemes,
  Theme,
} from 'ui'
import { useSetCommandMenuOpen } from 'ui-patterns'
import { useFeaturePreviewModal } from './App/FeaturePreview/FeaturePreviewContext'

export const LocalDropdown = () => {
  const { theme, setTheme } = useTheme()
  const setCommandMenuOpen = useSetCommandMenuOpen()
  const { openFeaturePreviewModal } = useFeaturePreviewModal()
  const router = useRouter()
  const signOut = useSignOut()
  const isLoggedIn = useIsLoggedIn()
  
  // Only show logout button in self-hosted mode when login is required
  const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true'
  const showLogout = !IS_PLATFORM && requireLogin && isLoggedIn
  
  const handleLogout = async () => {
    await signOut()
    router.push('/sign-in')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="border flex-shrink-0 px-3" asChild>
        <Button
          type="default"
          className="[&>span]:flex px-0 py-0 rounded-full overflow-hidden h-8 w-8"
        >
          <ProfileImage className="w-8 h-8 rounded-md" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-44">
        <DropdownMenuItem
          className="flex gap-2"
          onClick={openFeaturePreviewModal}
          onSelect={openFeaturePreviewModal}
        >
          <FlaskConical size={14} strokeWidth={1.5} className="text-foreground-lighter" />
          Feature previews
        </DropdownMenuItem>
        <DropdownMenuItem className="flex gap-2" onClick={() => setCommandMenuOpen(true)}>
          <Command size={14} strokeWidth={1.5} className="text-foreground-lighter" />
          Command menu
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => {
              setTheme(value)
            }}
          >
            {singleThemes.map((theme: Theme) => (
              <DropdownMenuRadioItem key={theme.value} value={theme.value}>
                {theme.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        {showLogout && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex gap-2" onClick={handleLogout}>
              <LogOut size={14} strokeWidth={1.5} className="text-foreground-lighter" />
              Log out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
