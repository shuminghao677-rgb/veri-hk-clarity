import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
      className="premium-container py-10 md:py-16"
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({
  eyebrow,
  icon,
  title,
  description,
  action,
  className = "",
}: {
  eyebrow: string;
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative mb-12 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end ${className}`}>
      <div className="pointer-events-none absolute -left-4 -top-8 h-40 w-52 rounded-full bg-primary/10 blur-[56px]" />
      <div className="pointer-events-none absolute left-1/4 -top-6 h-36 w-40 rounded-full bg-primary-glow/8 blur-[48px]" />
      <div className="relative max-w-4xl">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(8_23_45_/_42%)]">
          {icon}
          {eyebrow}
        </div>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.02em] text-[rgb(8_31_66_/_95%)] md:text-6xl">
          {title}
        </h1>
        {description && (
          <p className="mt-5 max-w-2xl text-base leading-7 text-[rgb(8_23_45_/_58%)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="relative lg:justify-self-end">{action}</div>}
    </div>
  );
}

export function Reveal({
  children,
  delay = 0,
  className,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.72, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
