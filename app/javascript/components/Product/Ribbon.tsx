import * as React from "react";

export const Ribbon = ({ children }: { children: React.ReactNode }) => (
  <div className="absolute top-3 left-3 z-10 inline-flex items-center rounded-full border border-lime/40 bg-lime px-2.5 py-0.5 text-xs font-bold text-black shadow-xs">
    {children}
  </div>
);
