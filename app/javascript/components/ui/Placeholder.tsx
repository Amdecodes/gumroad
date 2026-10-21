import * as React from "react";

import { classNames } from "$app/utils/classNames";

type PlaceholderProps = React.PropsWithChildren<{
  className?: string;
  role?: string;
  "aria-label"?: string;
  style?: React.CSSProperties;
}>;

export const Placeholder: React.FC<PlaceholderProps> = ({ className, children, ...rest }) => (
  <div
    className={classNames(
      "grid justify-items-center gap-4 rounded-xl border border-dashed border-border/70 bg-background p-8 text-center shadow-xs",
      "[&>.icon]:text-xl",
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

export const PlaceholderImage = ({ className, src, ...imgProps }: React.ImgHTMLAttributes<HTMLImageElement>) => (
  <figure className="w-full">
    <img
      src={src}
      loading="lazy"
      className={classNames("w-full rounded-lg", className)}
      role="presentation"
      {...imgProps}
    />
  </figure>
);
