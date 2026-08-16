import * as React from "react"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
    HTMLInputElement,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "defaultValue"> & {
        defaultValue?: number[]
        value?: number[]
        onValueChange?: (value: number[]) => void
        max?: number
        step?: number
    }
>(({ className, defaultValue, value, onValueChange, max = 100, step = 1, ...props }, ref) => {
    const [localValue, setLocalValue] = React.useState(defaultValue?.[0] ?? 0)
    const currentValue = value?.[0] ?? localValue

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = Number(e.target.value)
        setLocalValue(newVal)
        onValueChange?.([newVal])
    }

    const percentage = (currentValue / max) * 100

    return (
        <div className={cn("relative flex w-full touch-none select-none items-center", className)}>
            <input
                type="range"
                ref={ref}
                min={0}
                max={max}
                step={step}
                value={currentValue}
                onChange={handleChange}
                className={cn(
                    "h-2 w-full appearance-none bg-transparent cursor-pointer z-20 focus:outline-none disabled:pointer-events-none disabled:opacity-50",
                    // Webkit thumb
                    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:transition-colors",
                    // Mozilla thumb
                    "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background [&::-moz-range-thumb]:transition-colors"
                )}
                {...props}
            />
            {/* Track */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 h-2 w-full rounded-full bg-secondary overflow-hidden pointer-events-none z-10">
                <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${percentage}% ` }}
                />
            </div>
        </div>
    )
})
Slider.displayName = "Slider"

export { Slider }
