"use client";

import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl bg-neutral-200/60 dark:bg-neutral-800/60 skeleton",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
