"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-5 w-5 shrink-0 rounded border-2 border-gray-300 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    style={{
      backgroundColor: props.checked ? "rgb(37 99 235" : "white",
      borderColor: props.checked ? "rgb(37 99 235" : "rgb(209 213 219)",
    }}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className="flex items-center justify-center"
      style={{ color: "#ffffff" }}
    >
      <Check className="h-4 w-4" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };

// function Checkbox({
//   className,
//   ...props
// }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
//   return (
//     <CheckboxPrimitive.Root
//       data-slot="checkbox"
//       className={cn(
//         "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
//         className
//       )}
//       {...props}
//     >
//       <CheckboxPrimitive.Indicator
//         data-slot="checkbox-indicator"
//         className="grid place-content-center text-current transition-none"
//       >
//         <CheckIcon className="size-3.5" />
//       </CheckboxPrimitive.Indicator>
//     </CheckboxPrimitive.Root>
//   );
// }

// export { Checkbox };
