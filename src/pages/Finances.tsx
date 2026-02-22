import { DollarSign } from "lucide-react";

const Finances = () => (
  <div className="space-y-6">
    <div className="rounded-2xl bg-card p-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
        <DollarSign className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-card-foreground">Finance Tracking</h2>
      <p className="text-sm text-card-foreground/40 mt-2">Coming in Phase 3</p>
    </div>
  </div>
);
export default Finances;
