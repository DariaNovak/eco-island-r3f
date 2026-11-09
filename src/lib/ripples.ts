/**
 * Кільцевий буфер хвиль-брижів для шейдера води.
 * Кожен брижик — vec4(x, z, час_старту, сила). Плоский Float32Array
 * передається в uniform vec4 uRipples[N] без копіювання.
 * Найстаріший брижик перезаписується, коли буфер заповнено.
 */
export interface RippleBuffer {
  capacity: number
  data: Float32Array
  cursor: number
}

export function createRippleBuffer(capacity: number): RippleBuffer {
  const data = new Float32Array(capacity * 4)
  // Час старту далеко в минулому — брижик «згас» і не впливає на воду.
  for (let i = 0; i < capacity; i++) data[i * 4 + 2] = -1e4
  return { capacity, data, cursor: 0 }
}

export function addRipple(buffer: RippleBuffer, x: number, z: number, time: number, strength = 1): void {
  const offset = buffer.cursor * 4
  buffer.data[offset] = x
  buffer.data[offset + 1] = z
  buffer.data[offset + 2] = time
  buffer.data[offset + 3] = strength
  buffer.cursor = (buffer.cursor + 1) % buffer.capacity
}

/** Кількість брижів, що ще не згасли на момент time. */
export function activeRipples(buffer: RippleBuffer, time: number, lifetime: number): number {
  let count = 0
  for (let i = 0; i < buffer.capacity; i++) {
    if (time - buffer.data[i * 4 + 2] < lifetime) count++
  }
  return count
}
