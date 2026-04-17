import { ChevronDown, ChevronUp, ArrowLeft, Info, CheckCircle2 } from "lucide-react";

interface Step {
  number: number;
  label: string;
  time: string;
  active?: boolean;
  completed?: boolean;
  expanded?: boolean;
  subItems?: { label: string; completed?: boolean; active?: boolean }[];
}

const steps: Step[] = [
  { number: 1, label: "Party details", time: "5m" },
  { number: 2, label: "Case Details", time: "15m" },
  {
    number: 3,
    label: "Evidence",
    time: "5m",
    active: true,
    expanded: true,
    subItems: [
      { label: "Witnesses", completed: true },
      { label: "Documents", active: true },
    ],
  },
  { number: 4, label: "Affidavit", time: "5m" },
  { number: 5, label: "Preview", time: "5m" },
  { number: 6, label: "Sign", time: "5m" },
  { number: 7, label: "Pay fees", time: "5m" },
];

export function StepSidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="p-4">
        <a href="#" className="flex items-center gap-1.5 text-sm font-medium text-step-active">
          <ArrowLeft className="h-4 w-4" />
          Go to Home
        </a>
      </div>

      <div className="mx-4 mb-4 rounded-lg bg-info-bg border border-info-border p-3">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-info-text mt-0.5 shrink-0" />
          <div className="text-xs text-info-text">
            <p className="font-medium">You are filing a case</p>
            <p className="mt-1">
              Under <a href="#" className="underline">S-138, Negotiable Instruments Act</a> in the 24X7 ON COURT, Chandigarh
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2">
        {steps.map((step) => (
          <div key={step.number}>
            <button
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors ${
                step.active
                  ? "text-foreground font-semibold"
                  : "text-step-inactive hover:bg-muted"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={step.active ? "text-step-active" : ""}>{step.number}.</span>
                <span>{step.label}</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>⏱ {step.time}</span>
                {step.expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </span>
            </button>

            {step.expanded && step.subItems && (
              <div className="ml-6 mt-1 space-y-1 mb-2">
                {step.subItems.map((sub) => (
                  <div
                    key={sub.label}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${
                      sub.active
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {sub.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-step-active bg-step-active/20" />
                    )}
                    <span>{sub.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
