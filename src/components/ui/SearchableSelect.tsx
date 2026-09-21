"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  subtext?: string;
}

interface Props {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "-- Select --",
  searchPlaceholder = "Search...",
  disabled = false,
  required = false,
  className,
  id,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearch("");
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      opt.label.toLowerCase().includes(q) ||
      (opt.subtext && opt.subtext.toLowerCase().includes(q)) ||
      opt.value.toLowerCase().includes(q)
    );
  });

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Hidden input for HTML form validation if required */}
      {required && (
        <input
          tabIndex={-1}
          required={required}
          value={value}
          onChange={() => {}}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
        />
      )}

      {/* Select Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-3 py-2.5 rounded-lg border bg-card text-sm text-left outline-none flex items-center justify-between gap-2 transition-colors focus:ring-2 focus:ring-primary/40",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "ring-2 ring-primary/40 border-primary"
        )}
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>
          {selectedOption ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="font-medium text-foreground">{selectedOption.label}</span>
              {selectedOption.subtext && (
                <span className="text-xs text-muted-foreground">({selectedOption.subtext})</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <span className="text-muted-foreground text-xs shrink-0 transition-transform duration-200">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {/* Dropdown Overlay */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-xl border bg-card shadow-xl overflow-hidden text-sm flex flex-col max-h-72 animate-in fade-in-50 zoom-in-95"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          {/* Search Box */}
          <div className="p-2 border-b bg-muted/30 flex items-center gap-2" style={{ borderColor: "hsl(var(--border))" }}>
            <span className="text-muted-foreground text-xs pl-1">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted"
              >
                ✕
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 p-1 space-y-0.5 max-h-56">
            {placeholder && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-muted transition-colors text-muted-foreground italic flex items-center justify-between",
                  !value && "bg-muted font-medium text-foreground"
                )}
              >
                <span>{placeholder}</span>
                {!value && <span>✓</span>}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 text-sm hover:bg-muted/80",
                      isSelected && "bg-primary/10 text-primary font-semibold"
                    )}
                  >
                    <div className="flex flex-col truncate">
                      <span className="truncate">{opt.label}</span>
                      {opt.subtext && (
                        <span className="text-xs text-muted-foreground font-normal truncate">
                          {opt.subtext}
                        </span>
                      )}
                    </div>
                    {isSelected && <span className="text-primary font-bold shrink-0">✓</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
