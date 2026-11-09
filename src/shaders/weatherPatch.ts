import type { Material } from 'three'

/**
 * Розширення стандартного MeshStandardMaterial погодними ефектами через onBeforeCompile:
 *  - сніговий покрив: спершу біліють вершини і рівні поверхні, далі — все, що дивиться вгору;
 *  - волога: після дощу поверхні темнішають і починають блищати (менша шорсткість).
 *
 * Уніформи спільні для всіх матеріалів (той самий об'єкт { value }),
 * тож один запис у кадрі оновлює рельєф, дерева, дахи і каміння одночасно.
 */
export const weatherUniforms = {
  uSnow: { value: 0 },
  uWet: { value: 0 },
}

const VERTEX_PARS = /* glsl */ `
  #include <common>
  varying float vWeatherUp;
  varying float vWeatherHeight;
`

const VERTEX_MAIN = /* glsl */ `
  #include <begin_vertex>
  vWeatherUp = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz).y;
  vWeatherHeight = (modelMatrix * vec4(transformed, 1.0)).y;
`

const FRAGMENT_PARS = /* glsl */ `
  #include <common>
  uniform float uSnow;
  uniform float uWet;
  varying float vWeatherUp;
  varying float vWeatherHeight;
`

const FRAGMENT_COLOR = /* glsl */ `
  #include <color_fragment>
  float snowScore = vWeatherUp * 0.75 + clamp(vWeatherHeight / 9.0, 0.0, 1.0) * 0.25;
  float snowAmount = smoothstep(1.0 - uSnow, 1.08 - uSnow, snowScore)
    * smoothstep(0.05, 0.35, vWeatherHeight)
    * step(0.001, uSnow);
  float wetAmount = uWet * (1.0 - snowAmount);
  diffuseColor.rgb *= 1.0 - wetAmount * 0.35;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), snowAmount);
`

const FRAGMENT_ROUGHNESS = /* glsl */ `
  #include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.3, wetAmount * 0.8);
  roughnessFactor = mix(roughnessFactor, 0.85, snowAmount);
`

/** Додає погодні ефекти до матеріалу (мутує і повертає його). */
export function withWeather<M extends Material>(material: M): M {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnow = weatherUniforms.uSnow
    shader.uniforms.uWet = weatherUniforms.uWet
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', VERTEX_PARS)
      .replace('#include <begin_vertex>', VERTEX_MAIN)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', FRAGMENT_PARS)
      .replace('#include <color_fragment>', FRAGMENT_COLOR)
      .replace('#include <roughnessmap_fragment>', FRAGMENT_ROUGHNESS)
  }
  material.customProgramCacheKey = () => 'weather-patch'
  return material
}
