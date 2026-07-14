import { Moon, Sun } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/use-theme";

export function Topbar() {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/70 px-4 backdrop-blur-xl md:px-6">
      <SidebarTrigger />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold tracking-tight sm:text-base">
          VeriHK
        </div>
        <div className="hidden truncate text-[11px] text-muted-foreground sm:block">
          AI-powered Explainable Fact Verification
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label="Toggle theme"
        className="rounded-full"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Avatar className="h-9 w-9 ring-2 ring-primary/20">
        <AvatarFallback className="bg-gradient-to-br from-primary to-primary-glow text-primary-foreground text-xs font-semibold">
          HK
        </AvatarFallback>
      </Avatar>
    </header>
  );
}
