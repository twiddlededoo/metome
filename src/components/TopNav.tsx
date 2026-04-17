import { Globe, HelpCircle } from "lucide-react";

export function TopNav() {
  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded bg-foreground/10 flex items-center justify-center text-foreground font-bold text-lg">
          ⚖
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Globe className="h-4 w-4" />
          EN
        </button>
        <button className="text-sm text-muted-foreground hover:text-foreground">Support</button>
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">U</span>
        </div>
      </div>
    </header>
  );
}
