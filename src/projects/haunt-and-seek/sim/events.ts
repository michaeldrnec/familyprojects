// The event and hazard bus. stepWorld() returns what happened during the
// step as plain data; the renderer, the sound and the HUD each read the list.
// Nothing is emitted globally, so replays and tests stay deterministic.
import type { AbilityId, GhostId } from './config'
import type { HazardKind } from './types'

export type BarkKind = 'scared' | 'munch' | 'rush' | 'flee' | 'confused' | 'stuck' | 'skid' | 'spot' | 'bonk' | 'treat' | 'treadmill'

export type DenyReason = 'ecto' | 'cooldown' | 'busy' | 'locked' | 'range' | 'aim'

export type WorldEvent =
  | { type: 'scare'; ghost: GhostId | null; ability: AbilityId; amount: number; combo: boolean; x: number; y: number }
  | { type: 'cast'; ghost: GhostId; ability: AbilityId; x: number; y: number }
  | { type: 'denied'; ghost: GhostId; reason: DenyReason }
  | { type: 'eat'; x: number; y: number }
  | { type: 'drop'; tiles: number[] }
  | { type: 'gumball'; x: number; y: number }
  | { type: 'rushEnd' }
  | { type: 'bonk'; ghost: GhostId; x: number; y: number }
  | { type: 'respawn'; ghost: GhostId }
  | { type: 'wisp'; x: number; y: number }
  | { type: 'footstep'; x: number; y: number }
  | { type: 'shatter'; x: number; y: number }
  | { type: 'fizz'; x: number; y: number }
  | { type: 'skid'; x: number; y: number }
  | { type: 'bump'; x: number; y: number }
  | { type: 'stumble' }
  | { type: 'spotted'; ghost: GhostId }
  | { type: 'hazardEnd'; kind: HazardKind; x: number; y: number }
  | { type: 'bark'; kind: BarkKind }
  | { type: 'swap'; ghost: GhostId }
  | { type: 'flee' }
  | { type: 'won' }
  | { type: 'lost' }
