import { Cpu, HardDrive, MemoryStick, Zap } from "lucide-react";

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
}

function StatBlock({ icon, label, value, unit }: StatProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-card border border-border/50">
      <div className="text-primary">{icon}</div>
      <div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-lg font-display text-foreground">
          {value}
          <span className="text-xs text-muted-foreground ml-1">{unit}</span>
        </p>
      </div>
    </div>
  );
}

export function SystemStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatBlock icon={<Cpu className="h-4 w-4" />} label="CPU Usage" value="23" unit="%" />
      <StatBlock icon={<MemoryStick className="h-4 w-4" />} label="Memory" value="8.2" unit="GB" />
      <StatBlock icon={<HardDrive className="h-4 w-4" />} label="Storage" value="142" unit="GB" />
      <StatBlock icon={<Zap className="h-4 w-4" />} label="Active Tasks" value="4" unit="" />
    </div>
  );
}
