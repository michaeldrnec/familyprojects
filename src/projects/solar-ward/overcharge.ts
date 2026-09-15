// Overcharge Pulse (spec.md section 3): a rechargeable bonus weapon, direct
// analog to starwarden's Nova Bomb -- fills passively over time rather than
// being a pickup to hunt down, capped so it can't be stockpiled forever.
// Triggering it clears every beam/fighter within OVERCHARGE_RADIUS of the
// turret's actual world position.
export const OVERCHARGE_MAX_CHARGES = 2
export const OVERCHARGE_RECHARGE_TIME = 40 // seconds per charge
export const OVERCHARGE_RADIUS = 130
export const OVERCHARGE_FLASH_DURATION = 0.35
