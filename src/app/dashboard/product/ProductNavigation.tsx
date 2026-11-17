"use client";

import Link from "next/link";

type View = "new" | "edit" | "models";
export default function ProductNavigation({ active, onSelect, preserveNew = true }: {
  active: View;
  preserveNew?: boolean;
  onSelect?: (view: "new" | "models") => boolean | void;
}) {
  return <nav aria-label="Gerenciamento de produtos" className="mb-6 flex flex-wrap gap-3">
    {([
      ["new", "Novo produto", "/dashboard/product"],
      ["edit", "Editar produtos", "/dashboard/editProduct"],
      ["models", "Meus modelos", "/dashboard/product?view=models"],
    ] as const).map(([value, label, href]) => <Link key={value} href={href}
      data-preserve-product-form={onSelect && (value === "models" || (value === "new" && preserveNew)) ? true : undefined}
      aria-current={active === value ? "page" : undefined}
      onClick={event => {
        if (onSelect && value !== "edit" && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
          if (onSelect(value) !== false) event.preventDefault();
        }
      }}
      className={`rounded-xl border px-4 py-3 text-sm font-semibold ${active === value
        ? "border-orange-500 bg-orange-50 text-orange-700"
        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
      {label}
    </Link>)}
  </nav>;
}
