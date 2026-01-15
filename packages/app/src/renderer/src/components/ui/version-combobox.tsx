"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

interface VersionComboboxProps {
  versions: string[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
}

// Custom filter for version search - matches versions that start with or contain the search term
const versionFilter = (value: string, search: string): number => {
  const normalizedValue = value.toLowerCase()
  const normalizedSearch = search.toLowerCase().trim()
  
  if (!normalizedSearch) return 1
  
  // Exact match gets highest score
  if (normalizedValue === normalizedSearch) return 1
  
  // Starts with search term gets high score
  if (normalizedValue.startsWith(normalizedSearch)) return 0.8
  
  // Contains search term gets medium score
  if (normalizedValue.includes(normalizedSearch)) return 0.5
  
  // No match
  return 0
}

export function VersionCombobox({
  versions,
  value,
  onValueChange,
  placeholder = "Select version...",
  searchPlaceholder = "Search version...",
  emptyText = "No version found.",
}: VersionComboboxProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={versionFilter}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <ScrollArea className="h-[200px]">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {versions.map((version) => (
                  <CommandItem
                    key={version}
                    value={version}
                    onSelect={(currentValue) => {
                      onValueChange(currentValue)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === version ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {version}
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
