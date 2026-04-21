import type { ReactNode } from "react";

export type AutonomousBoardItem = {
  id: string;
  headline: string;
  detail?: string | null;
  meta?: Array<string | null | undefined>;
  href?: string | null;
};

function cleanMeta(values: Array<string | null | undefined> | undefined) {
  return (values ?? []).filter((value): value is string => Boolean(value && value.trim()));
}

export function AutonomousRecordBoard({
  eyebrow,
  title,
  description,
  items,
  emptyTitle,
  emptyDescription,
  headerAction,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: AutonomousBoardItem[];
  emptyTitle: string;
  emptyDescription: string;
  headerAction?: ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5">
      <header className="shell-surface-elevated space-y-3 px-5 py-5">
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {eyebrow}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-foreground">
              {title}
            </h1>
            <p className="max-w-3xl text-[13px] leading-5 text-muted-foreground">
              {description}
            </p>
          </div>
          {headerAction}
        </div>
      </header>

      <section className="grid gap-4">
        {items.length === 0 ? (
          <div className="shell-surface-card px-5 py-6">
            <div className="text-[16px] font-medium text-foreground">{emptyTitle}</div>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted-foreground">
              {emptyDescription}
            </p>
          </div>
        ) : (
          items.map((item) => {
            const meta = cleanMeta(item.meta);
            const body = (
              <div className="shell-surface-card px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-[16px] font-medium text-foreground">
                      {item.headline}
                    </div>
                    {item.detail ? (
                      <p className="max-w-3xl text-[13px] leading-6 text-muted-foreground">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1.5 text-[11px] text-muted-foreground">
                    {item.id}
                  </div>
                </div>
                {meta.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {meta.map((value) => (
                      <span
                        key={`${item.id}:${value}`}
                        className="rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1.5 text-[11px] text-muted-foreground"
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );

            return item.href ? (
              <a key={item.id} href={item.href} className="block transition hover:opacity-95">
                {body}
              </a>
            ) : (
              <div key={item.id}>{body}</div>
            );
          })
        )}
      </section>
    </main>
  );
}
