// The Nova Bomb: a screen-clearing bonus weapon that recharges on its own
// over time rather than being something to hunt down and collect (see
// SPEC discussion) -- it "becomes available every once in a while" as a
// passive ability, capped so it can't be stockpiled indefinitely.
export const NOVA_MAX_CHARGES = 2
export const NOVA_RECHARGE_TIME = 45 // seconds per charge
// A destroyed entity's screen-space x must fall within this margin outside
// the canvas bounds to count as "on screen" and be caught by the blast --
// matches the render-culling margins already used for enemies/asteroids.
export const NOVA_CLEAR_MARGIN = 60
export const NOVA_FLASH_DURATION = 0.35
