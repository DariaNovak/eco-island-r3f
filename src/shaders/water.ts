import { WATER } from '../config'

/**
 * Процедурна вода.
 *
 * Вершинний шейдер: сума спрямованих синусоїд (хвилі від вітру) + кільцеві
 * брижі від кліків, падінь і руху камери. Нормаль рахується аналітично
 * з градієнта висоти — без додаткових текстур.
 *
 * Фрагментний шейдер: глибина під водою береться з текстури карти висот острова,
 * тож мілина світліша й прозоріша, а біля берега б'ється анімована піна.
 * Френель змішує колір води з кольором неба залежно від кута погляду камери.
 */
export const RIPPLE_COUNT = WATER.maxRipples

export const waterVertexShader = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>

  #define RIPPLE_COUNT ${RIPPLE_COUNT}

  uniform float uTime;
  uniform float uWaveHeight;
  uniform vec2 uWindDirection;
  uniform vec4 uRipples[RIPPLE_COUNT];
  uniform float uRippleLifetime;

  varying vec3 vWorldPosition;
  varying vec3 vNormalW;
  varying float vWave;
  varying float vRipple;

  // Одна хвиля: додає висоту в h і її похідні в grad.
  void addWave(vec2 p, vec2 dir, float frequency, float speed, float amplitude, inout float h, inout vec2 grad) {
    float phase = dot(dir, p) * frequency + uTime * speed;
    h += sin(phase) * amplitude;
    grad += dir * cos(phase) * amplitude * frequency;
  }

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec2 p = world.xz;

    vec2 wind = normalize(uWindDirection);
    vec2 side = vec2(-wind.y, wind.x);
    float h = 0.0;
    vec2 grad = vec2(0.0);
    addWave(p, wind, 0.22, 1.3, uWaveHeight, h, grad);
    addWave(p, normalize(wind + side * 0.6), 0.37, 1.9, uWaveHeight * 0.55, h, grad);
    addWave(p, normalize(wind - side * 0.8), 0.61, 2.4, uWaveHeight * 0.3, h, grad);
    addWave(p, side, 1.13, 3.1, uWaveHeight * 0.12 + 0.01, h, grad);

    float ripple = 0.0;
    for (int i = 0; i < RIPPLE_COUNT; i++) {
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (age < 0.0 || age > uRippleLifetime) continue;
      vec2 toPoint = p - r.xy;
      float dist = length(toPoint) + 1e-4;
      float front = age * 5.0;
      float fade = (1.0 - age / uRippleLifetime) * r.w;
      float envelope = exp(-pow((dist - front) * 0.7, 2.0)) * fade;
      float k = 3.0;
      h += sin((dist - front) * k) * 0.22 * envelope;
      grad += (toPoint / dist) * cos((dist - front) * k) * k * 0.22 * envelope;
      ripple += envelope;
    }

    world.y += h;
    vWave = h;
    vRipple = ripple;
    vWorldPosition = world.xyz;
    vNormalW = normalize(vec3(-grad.x, 1.0, -grad.y));

    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

export const waterFragmentShader = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform float uWaveHeight;
  uniform sampler2D uHeightMap;
  uniform float uTerrainSize;
  uniform float uTerrainResolution;
  uniform vec2 uHeightRange;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uFoamColor;
  uniform vec3 uSkyColor;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform float uAmbient;
  uniform float uRain;

  varying vec3 vWorldPosition;
  varying vec3 vNormalW;
  varying float vWave;
  varying float vRipple;

  float terrainHeight(vec2 xz) {
    vec2 grid = (xz + uTerrainSize * 0.5) / uTerrainSize * (uTerrainResolution - 1.0);
    vec2 uv = (grid + 0.5) / uTerrainResolution;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return uHeightRange.x;
    return mix(uHeightRange.x, uHeightRange.y, texture2D(uHeightMap, uv).r);
  }

  void main() {
    vec3 normal = normalize(vNormalW);
    // Краплі дощу: дрібна «рябизна» нормалі.
    normal.xz += uRain * 0.08 * vec2(
      sin(vWorldPosition.x * 9.0 + uTime * 7.0) * cos(vWorldPosition.z * 7.0 - uTime * 5.0),
      cos(vWorldPosition.z * 8.0 + uTime * 6.0) * sin(vWorldPosition.x * 6.0 + uTime * 4.0)
    );
    normal = normalize(normal);

    float depth = max(vWorldPosition.y - terrainHeight(vWorldPosition.xz), 0.0);
    float shallow = exp(-depth * 0.55);

    vec3 color = mix(uDeepColor, uShallowColor, shallow);
    float light = uAmbient + uSunIntensity * 0.35 * max(dot(normal, uSunDirection), 0.0);
    color *= light;

    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(viewDirection, normal), 0.0), 5.0);
    color = mix(color, uSkyColor, fresnel * 0.7);

    vec3 halfVector = normalize(uSunDirection + viewDirection);
    float specular = pow(max(dot(normal, halfVector), 0.0), 180.0) * uSunIntensity;
    color += uSunColor * specular * step(0.0, uSunDirection.y);

    // Піна: смуги біля берега, що набігають на сушу, гребені хвиль і брижі.
    float shoreBand = 0.5 + 0.5 * sin(depth * 9.0 - uTime * 2.2);
    float shoreFoam = smoothstep(0.9, 0.0, depth) * smoothstep(0.35, 0.8, shoreBand + (1.0 - depth));
    float crestFoam = smoothstep(uWaveHeight * 1.35, uWaveHeight * 1.9 + 0.05, vWave);
    float foam = clamp(shoreFoam + crestFoam * 0.45 + vRipple * 0.5, 0.0, 1.0);
    color = mix(color, uFoamColor * (uAmbient + uSunIntensity * 0.3), foam);

    float alpha = mix(0.92, 0.45, shallow);
    alpha = max(alpha, foam);
    gl_FragColor = vec4(color, alpha);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`
