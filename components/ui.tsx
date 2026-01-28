import React from "react";

export function Card(props: React.PropsWithChildren<{ className?: string; title?: string; }>) {
  return (
    <div className={"rounded-xl border border-zinc-200 bg-white shadow-sm " + (props.className ?? "")}>
      {props.title ? (
        <div className="px-4 py-3 border-b border-zinc-100 font-medium">{props.title}</div>
      ) : null}
      <div className="p-4">{props.children}</div>
    </div>
  );
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const variant = props.variant ?? "primary";
  const cls = variant === "primary"
    ? "bg-zinc-900 text-white hover:bg-zinc-800"
    : "bg-transparent hover:bg-zinc-100";
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed " +
        cls +
        " " +
        (props.className ?? "")
      }
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      {label ? <div className="mb-1 text-xs font-medium text-zinc-700">{label}</div> : null}
      <input
        {...rest}
        className={
          "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200 " +
          (props.className ?? "")
        }
      />
    </label>
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      {label ? <div className="mb-1 text-xs font-medium text-zinc-700">{label}</div> : null}
      <select
        {...rest}
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
      />
    </label>
  );
}

export function FieldRow({ children }: React.PropsWithChildren) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}
