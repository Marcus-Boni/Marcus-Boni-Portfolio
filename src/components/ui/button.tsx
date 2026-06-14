import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { type ButtonHTMLAttributes, type Ref } from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // a ::before layer (kept behind the label via `isolate` + `-z-10`) wipes up
  // from the bottom on hover — robust against class-merging and Slot/asChild
  'relative isolate inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap font-mono uppercase tracking-[0.2em] transition-[color,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] before:absolute before:inset-0 before:-z-10 before:origin-bottom before:scale-y-0 before:transition-transform before:duration-500 before:ease-[cubic-bezier(0.16,1,0.3,1)] hover:before:scale-y-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // ember wipes up over the bordered base
        default:
          'border border-bone/30 text-bone before:bg-ember hover:border-ember hover:text-ink',
        ghost: 'text-bone-dim transition-colors before:hidden hover:text-ember',
        // bone wipes up over the ember base
        ember: 'bg-ember text-ink before:bg-bone',
      },
      size: {
        default: 'h-12 px-8 text-[11px]',
        lg: 'h-16 px-12 text-xs',
        pill: 'h-14 rounded-full px-10 text-[11px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  ref?: Ref<HTMLButtonElement>
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
}

export { Button }
