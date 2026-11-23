"use client";

export function WorkspaceTabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (value: T) => void; items: Array<{ value: T; label: string }>; label: string }) {
  return <div className="workspace-tabs" role="group" aria-label={label}>{items.map((item) => <button type="button" key={item.value} aria-pressed={value === item.value} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}
