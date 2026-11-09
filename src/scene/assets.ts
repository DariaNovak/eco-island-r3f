import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  type ColorRepresentation,
  type MeshStandardMaterialParameters,
} from 'three'
import type { Environment } from '../lib/environment'
import { withWeather } from '../shaders/weatherPatch'

/**
 * Спільні геометрії та матеріали для всіх об'єктів острова.
 *
 * Сотня дерев використовує ті самі кілька геометрій і матеріалів —
 * на GPU завантажується одна копія, а зміна кольору чи снігового покриву
 * в одному місці миттєво діє на всі об'єкти. Ресурси живуть увесь час
 * роботи застосунку, тому окремо не звільняються.
 */

const standard = (color: ColorRepresentation, extra: MeshStandardMaterialParameters = {}) =>
  withWeather(new MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra }))

export const geometries = {
  trunk: new CylinderGeometry(0.12, 0.2, 1.4, 6).translate(0, 0.7, 0),
  birchTrunk: new CylinderGeometry(0.08, 0.13, 2.4, 6).translate(0, 1.2, 0),
  cone: new ConeGeometry(1, 1, 7),
  blob: new IcosahedronGeometry(1, 0),
  rock: new DodecahedronGeometry(0.7, 0),
  box: new BoxGeometry(1, 1, 1),
  roof: new ConeGeometry(1, 1, 4).rotateY(Math.PI / 4),
  cloudPuff: new IcosahedronGeometry(1, 1),
}

export const materials = {
  bark: standard('#6b4a2f'),
  birchBark: standard('#e9e4d8'),
  pine: standard('#2f6b3a'),
  leaves: standard('#4f9a3c'),
  birchLeaves: standard('#9cc24a'),
  rock: {
    grey: standard('#8b8a86'),
    mossy: standard('#6f7f5a'),
    sandstone: standard('#c49a6c'),
  },
  wool: standard('#f3f0e8'),
  fox: standard('#d9692a'),
  pig: standard('#f0a3a8'),
  hoof: standard('#2b2a28'),
  walls: {
    red: standard('#c8553d'),
    blue: standard('#4f7cac'),
    yellow: standard('#e8c547'),
  },
  roof: standard('#5a3b2e'),
  door: standard('#3d2a1e'),
  window: new MeshStandardMaterial({ color: '#2a3a4a', emissive: new Color('#ffcf73'), emissiveIntensity: 0 }),
  cloud: new MeshStandardMaterial({ color: '#ffffff', flatShading: true, transparent: true, depthWrite: false }),
}

const CLOUD_WHITE = new Color('#ffffff')
const CLOUD_STORM = new Color('#4a4f58')
const CLOUD_NIGHT = new Color('#1d2333')

/** Оновлює спільні матеріали відповідно до довкілля (викликається раз на кадр). */
export function updateSharedMaterials(env: Environment): void {
  const night = 1 - env.daylight
  // Вікна світяться вночі та в негоду.
  materials.window.emissiveIntensity = Math.max(night, env.storm * 0.6) * 2.2

  const cloud = materials.cloud
  cloud.opacity = 0.25 + env.cloud * 0.7
  cloud.color.copy(CLOUD_WHITE).lerp(CLOUD_STORM, Math.max(env.storm, env.rain * 0.6)).lerp(CLOUD_NIGHT, night * 0.8)
}
