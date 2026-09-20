'use client'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { LogOut, Moon, Sun } from 'lucide-react'
import type { ViewKey } from './app-shell'

export interface PaletteItem {
  key: ViewKey
  label: string
  section: string
  icon: React.ComponentType<{ className?: string }>
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: PaletteItem[]
  onNavigate: (v: ViewKey) => void
  dark: boolean
  onToggleTheme: () => void
  onSignOut: () => void
}

export function CommandPalette({ open, onOpenChange, items, onNavigate, dark, onToggleTheme, onSignOut }: CommandPaletteProps) {
  const sections = items.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    ;(acc[item.section] ??= []).push(item)
    return acc
  }, {})

  const run = (fn: () => void) => {
    onOpenChange(false)
    // Defer so focus returns to the app before the action changes the view.
    setTimeout(fn, 50)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Quick actions"
      description="Jump to a page or run a command"
      className="[&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground/70 [&_[cmdk-input]]:h-11 [&_[cmdk-item]]:py-2.5"
    >
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList className="max-h-[320px]">
        <CommandEmpty>No matching commands.</CommandEmpty>
        {Object.entries(sections).map(([section, sectionItems], i) => (
          <div key={section}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={section}>
              {sectionItems.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem key={item.key} value={`${item.label} ${item.section}`} onSelect={() => run(() => onNavigate(item.key))}>
                    <Icon className="opacity-70" />
                    <span className="text-[13.5px]">{item.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </div>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="toggle theme dark light" onSelect={() => run(onToggleTheme)}>
            {dark ? <Sun className="opacity-70" /> : <Moon className="opacity-70" />}
            <span className="text-[13.5px]">{dark ? 'Switch to light mode' : 'Switch to dark mode'}</span>
          </CommandItem>
          <CommandItem value="sign out logout" onSelect={() => run(onSignOut)}>
            <LogOut className="opacity-70" />
            <span className="text-[13.5px]">Sign out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
