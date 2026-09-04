import React from "react";
import { cn } from "@/lib/utils";
import { userInitials } from "@/hooks/useAuth";

export interface MentionMember {
  userId: number;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface MentionSuggestionListProps {
  members: MentionMember[];
  selectedIndex: number;
  onSelect: (member: MentionMember) => void;
  className?: string;
}

export default function MentionSuggestionList({
  members,
  selectedIndex,
  onSelect,
  className,
}: MentionSuggestionListProps) {
  if (members.length === 0) {
    return (
      <div
        className={cn(
          "z-50 min-w-[220px] max-w-xs rounded-xl border border-border/80 bg-popover p-2 text-popover-foreground shadow-lg backdrop-blur-md animate-in fade-in-0 zoom-in-95",
          className,
        )}
      >
        <p className="px-3 py-2 text-xs text-muted-foreground italic text-center">
          No matching members
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "z-50 min-w-[240px] max-w-sm rounded-xl border border-border/80 bg-popover/95 p-1 text-popover-foreground shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 flex flex-col gap-0.5",
        className,
      )}
      role="listbox"
    >
      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 mb-1 flex items-center justify-between">
        <span>Team Members</span>
      </div>

      <div className="max-h-52 overflow-y-auto space-y-0.5 pr-0.5">
        {members.map((member, index) => {
          const isSelected = index === selectedIndex;
          const fullName = [member.firstName, member.lastName]
            .filter(Boolean)
            .join(" ")
            .trim();
          const displayName = fullName || member.email;
          const initials = userInitials(member);

          return (
            <button
              key={member.userId}
              type="button"
              role="option"
              aria-selected={isSelected}
              onMouseDown={(e) => {
                // Prevent textarea / editor from blurring before click fires
                e.preventDefault();
                onSelect(member);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors select-none",
                isSelected
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-muted/70 text-foreground",
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border",
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
                    : "bg-primary/10 text-primary border-primary/20",
                )}
              >
                {initials}
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate font-medium">{displayName}</span>
                {fullName && (
                  <span
                    className={cn(
                      "truncate text-[10px]",
                      isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {member.email}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="px-2 py-1 mt-1 border-t border-border/40 text-[9px] text-muted-foreground flex items-center justify-between">
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/50 text-[9px] font-mono">↑</kbd>
          <kbd className="ml-1 px-1 py-0.5 rounded bg-muted/60 border border-border/50 text-[9px] font-mono">↓</kbd> navigate
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/50 text-[9px] font-mono">↵</kbd> select
        </span>
      </div>
    </div>
  );
}
