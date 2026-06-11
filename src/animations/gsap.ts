import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger, CustomEase)

/** Signature ease used across reveals — a hard launch with a long settle. */
export const EASE_SIGNAL = CustomEase.create('signal', 'M0,0 C0.19,1 0.22,1 1,1')

gsap.defaults({ ease: EASE_SIGNAL, duration: 1 })

export { gsap, ScrollTrigger }
