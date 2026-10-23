// What a mini-game needs to know about the night around it, read fresh every
// frame (the night keeps running while you play).
export interface MiniEnv {
  frozen: boolean // paused, or away at the sink
  tempo: number // >1 while you have the jitters
  mistap: number // chance a tap lands off target
  wobble: number // px of cursor drift from the jitters
  catOnScreen: boolean // the ignored cat is lying across part of Bug Hunt
  sleep: number
}
