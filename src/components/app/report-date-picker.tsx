import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReportDatePicker({ date, error }: { date: string; error?: string }) {
  return (
    <form action="/reports/new" method="get" className="mb-4 grid gap-2 rounded-xl border p-4">
      <Label htmlFor="report-date">Отчётная дата (пятница)</Label>
      <div className="flex flex-wrap gap-2">
        <Input id="report-date" name="date" type="date" defaultValue={date} required className="w-auto" />
        <Button type="submit" variant="outline">Открыть отчёт</Button>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
