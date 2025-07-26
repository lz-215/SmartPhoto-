"use client";

import type * as React from "react";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "~/lib/cn";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = ({
  children,
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item> & {
  ref?: React.RefObject<null | React.ElementRef<
    typeof AccordionPrimitive.Item
  >>;
}) => (
  <AccordionPrimitive.Item
    className={cn("border-b", className)}
    ref={ref}
    {...props}
  >
    {children}
  </AccordionPrimitive.Item>
);
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = ({
  children,
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & {
  ref?: React.RefObject<null | React.ElementRef<
    typeof AccordionPrimitive.Trigger
  >>;
}) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      className={cn(
        `
          flex flex-1 items-center justify-between py-4 font-medium
          transition-all
          hover:underline
          [&[data-state=open]>svg]:rotate-180
        `,
        className,
      )}
      ref={ref}
      {...props}
    >
      {children}
      <ChevronDown
        className={`
        h-4 w-4 shrink-0 transition-transform duration-200
      `}
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
);
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = ({
  children,
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> & {
  ref?: React.RefObject<null | React.ElementRef<
    typeof AccordionPrimitive.Content
  >>;
}) => (
  <AccordionPrimitive.Content
    className={cn(
      `
        data-[state=closed]:animate-accordion-up
        data-[state=open]:animate-accordion-down
        overflow-hidden text-sm transition-all
      `,
      className,
    )}
    ref={ref}
    {...props}
  >
    <div className="pt-0 pb-4">{children}</div>
  </AccordionPrimitive.Content>
);
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
