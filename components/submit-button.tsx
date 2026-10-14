"use client";

import { useFormStatus } from "react-dom";

/**
 * Tombol submit yang mengunci diri saat form dikirim.
 * Mencegah klik ganda → submit ganda → data duplikat.
 */
export function SubmitButton({
  children,
  pendingChildren,
  className = "",
}: {
  children: React.ReactNode;
  pendingChildren?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`cursor-pointer disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {pending && pendingChildren ? pendingChildren : children}
    </button>
  );
}
