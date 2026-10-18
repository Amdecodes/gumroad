import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { classNames } from "$app/utils/classNames";

const tabsVariants = cva("", {
  variants: {
    variant: {
      pills: "flex gap-3 overflow-x-auto",
      buttons: "grid gap-3 md:auto-cols-fr md:grid-flow-col",
    },
  },
  defaultVariants: {
    variant: "pills",
  },
});

const tabVariants = cva("", {
  variants: {
    variant: {
      pills: "shrink-0 rounded-full border border-border/40 px-3.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-active-bg",
      buttons:
        "flex items-start gap-3 rounded-lg border border-border px-4 py-3 text-left transition-all duration-150 not-active:hover:bg-active-bg",
    },
    active: {
      true: "bg-background",
      false: "",
    },
  },
  compoundVariants: [
    {
      variant: "pills",
      active: true,
      className: "border-selected-border bg-selected-bg text-foreground font-semibold shadow-xs",
    },
    {
      variant: "buttons",
      active: true,
      // The important modifier is required: Tab wraps Button via asChild, so both class strings are
      // joined and Button's `border-border` can otherwise win the CSS-order fight.
      className: "border-indicator! ring-1 ring-indicator shadow-xs",
    },
  ],
  defaultVariants: {
    variant: "pills",
    active: false,
  },
});

const TabVariantContext = React.createContext<"pills" | "buttons">("pills");

interface TabsProps extends React.HTMLProps<HTMLDivElement>, VariantProps<typeof tabsVariants> {
  children: React.ReactNode;
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(({ children, className, variant, ...props }, ref) => (
  <TabVariantContext.Provider value={variant ?? "pills"}>
    <div role="tablist" className={classNames(tabsVariants({ variant }), className)} {...props} ref={ref}>
      {children}
    </div>
  </TabVariantContext.Provider>
));
Tabs.displayName = "Tabs";

export const TabIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="flex shrink-0 items-center text-xl">{children}</div>
);

interface TabProps extends Omit<React.HTMLProps<HTMLAnchorElement>, "selected"> {
  children: React.ReactNode;
  asChild?: boolean;
  isSelected: boolean;
}

export const Tab = ({ children, isSelected, className, asChild, ...props }: TabProps) => {
  const variant = React.useContext(TabVariantContext);
  const Component = asChild ? Slot : "a";

  return (
    <Component
      className={classNames("border no-underline", tabVariants({ variant, active: isSelected }), className)}
      role="tab"
      aria-selected={isSelected}
      {...props}
    >
      {children}
    </Component>
  );
};
