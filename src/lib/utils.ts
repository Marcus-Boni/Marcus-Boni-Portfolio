import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
