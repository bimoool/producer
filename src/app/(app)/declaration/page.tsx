import { DeclarationItemCard } from "@/components/app/declaration-item";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getDeclaration, getProgressHistory } from "@/lib/data";
import { formatRu } from "@/lib/domain/dates";

export default async function DeclarationPage() {
  const decl = await getDeclaration();
  if (!decl) return <p>Декларация не найдена.</p>;
  const histories = await Promise.all(decl.items.map((i) => getProgressHistory(i.id)));
  return (
    <>
      <PageHeader
        title={decl.title}
        description="Формулировки зафиксированы и не редактируются. Меняется только статус и подтверждённый прогресс."
      />
      <div className="grid gap-4">
        {decl.items.map((item, idx) => (
          <DeclarationItemCard key={item.id} item={{ ...item, history: histories[idx] }} />
        ))}
        <Card>
          <CardContent className="grid gap-2 text-sm">
            {decl.priceOfWord ? (
              <div>
                <span className="text-muted-foreground">Цена слова: </span>
                {decl.priceOfWord.toLocaleString("ru-RU")} ₽
              </div>
            ) : null}
            {decl.reward ? (
              <div>
                <span className="text-muted-foreground">Награда: </span>
                {decl.reward}
              </div>
            ) : null}
            {decl.financialHypothesis ? (
              <div>
                <span className="text-muted-foreground">Финансовая гипотеза: </span>
                {decl.financialHypothesis}
              </div>
            ) : null}
            <div className="text-muted-foreground">
              Дата декларации: {formatRu(decl.declaredOn)} · Отсчёт недель с {formatRu(decl.cycleStart)}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
