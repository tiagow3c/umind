import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function Line({ w, className, delay }: { w: string; className?: string; delay?: number }) {
  return (
    <Skeleton
      className={cn("h-3.5 rounded-full bg-muted-foreground/10", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    />
  );
}

const TRANSCRIPT_WIDTHS = ["96%", "78%", "90%", "64%", "84%"];

export function MeetingSkeleton() {
  return (
    <section aria-hidden className="select-none space-y-8">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        Preparando o resumo, a transcrição e as tarefas…
      </p>

      <div className="space-y-6">
        <div className="inline-flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md bg-muted" />
          <Skeleton className="h-9 w-28 rounded-md bg-muted/60" />
          <Skeleton className="h-9 w-20 rounded-md bg-muted/60" />
        </div>

        <div className="space-y-3">
          <Line w="140px" delay={100} />
          <Line w="92%" delay={200} className="h-6 rounded-md" />
          <Line w="70%" delay={300} className="h-6 rounded-md" />
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {[0, 1].map((col) => (
            <div key={col} className="space-y-3">
              <div className="border-b pb-2">
                <Line w="110px" delay={400 + col * 150} className="h-5" />
              </div>
              {[100, 88, 94, 62].map((pct, i) => (
                <Line key={i} w={`${pct}%`} delay={500 + col * 150 + i * 120} />
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-2">
          {TRANSCRIPT_WIDTHS.map((pct, i) => (
            <div key={i} className="grid grid-cols-[56px_1fr] gap-3">
              <Line w="40px" delay={700 + i * 100} />
              <Line w={pct} delay={750 + i * 100} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
