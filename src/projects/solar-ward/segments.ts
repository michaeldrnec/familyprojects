// Core Integrity (spec.md section 5): five independent segments ringing the
// star instead of one shared health bar. A beam/fighter that isn't
// intercepted damages specifically the segment at the angle it arrived
// from -- neglecting one side of the sky costs that side, not an abstract
// pool, which is what ties the orbital-aiming mechanic to the stakes.
import { angleDelta, normalizeAngle } from './physics'

export const SEGMENT_COUNT = 5
export const SEGMENT_HEALTH = 3
export const SEGMENT_ARC = (Math.PI * 2) / SEGMENT_COUNT

export interface Segment {
  health: number
}

export function initialSegments(): Segment[] {
  return Array.from({ length: SEGMENT_COUNT }, () => ({ health: SEGMENT_HEALTH }))
}

// Which segment a given world angle belongs to -- segment i is centered on
// angle i * SEGMENT_ARC, so this rounds to the nearest segment center.
export function segmentIndexForAngle(angle: number): number {
  const a = normalizeAngle(angle)
  return Math.round(a / SEGMENT_ARC) % SEGMENT_COUNT
}

export function segmentCenterAngle(index: number): number {
  return index * SEGMENT_ARC
}

export function segmentArcBounds(index: number): { start: number; end: number } {
  const center = segmentCenterAngle(index)
  return { start: center - SEGMENT_ARC / 2, end: center + SEGMENT_ARC / 2 }
}

export function totalRemainingHealth(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + s.health, 0)
}

export function allSegmentsDestroyed(segments: Segment[]): boolean {
  return segments.every((s) => s.health <= 0)
}

// Used by fighters to steer toward whichever live segment is nearest their
// current angle isn't needed here -- kept purely as damage bookkeeping; the
// angleDelta import supports call sites that need the shortest-path angle
// to a segment center.
export function angleToSegment(fromAngle: number, index: number): number {
  return angleDelta(segmentCenterAngle(index), fromAngle)
}
