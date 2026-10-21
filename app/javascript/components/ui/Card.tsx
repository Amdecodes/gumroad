import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { classNames } from "$app/utils/classNames";

type CardProps = React.PropsWithChildren<{
  className?: string | undefined;
  asChild?: boolean;
  borderless?: boolean;
}> &
  React.HTMLAttributes<HTMLElement>;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, asChild, borderless = false, children, ...rest }, ref) => {
    const Component = asChild ? Slot : "div";
    return (
      <Component
        ref={ref}
        className={classNames(
          "grid divide-y divide-solid divide-border rounded-xl border border-border bg-background shadow-xs",
          borderless && "gap-4 border-none shadow-none [&>*]:border-none [&>*]:p-0",
          className,
        )}
        {...rest}
      >
        {children}
      </Component>
    );
  },
);

Card.displayName = "Card";

type CardContentProps = React.PropsWithChildren<{
  className?: string | undefined;
  asChild?: boolean;
  details?: boolean;
}> &
  React.HTMLAttributes<HTMLElement>;

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, asChild, details, children, ...rest }, ref) => {
    const Component = asChild ? Slot : "div";
    return (
      <Component
        ref={ref}
        className={classNames("flex flex-wrap items-center justify-between gap-4 p-4", details && "block", className)}
        {...rest}
      >
        {children}
      </Component>
    );
  },
);

CardContent.displayName = "CardContent";

type CardHeaderProps = React.PropsWithChildren<{
  className?: string | undefined;
}> &
  React.HTMLAttributes<HTMLDivElement>;

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(({ className, children, ...rest }, ref) => (
  <div
    ref={ref}
    className={classNames("flex items-center justify-between border-b border-border p-4", className)}
    {...rest}
  >
    {children}
  </div>
));

CardHeader.displayName = "CardHeader";

type CardTitleProps = React.PropsWithChildren<{
  className?: string | undefined;
}> &
  React.HTMLAttributes<HTMLHeadingElement>;

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, ...rest }, ref) => (
    <h3 ref={ref} className={classNames("text-base leading-none font-semibold tracking-tight", className)} {...rest}>
      {children}
    </h3>
  ),
);

CardTitle.displayName = "CardTitle";
