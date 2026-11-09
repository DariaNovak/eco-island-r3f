/**
 * GPU-частинки опадів. Позиції не оновлюються з JS: кожна частинка
 * має стартову точку й швидкість (атрибути), а вершинний шейдер рахує,
 * де вона зараз, через mod() — краплі нескінченно «прокручуються» в об'ємі.
 * Тому тисячі частинок коштують лише оновлення одного uniform uTime.
 *
 * Дефайн SNOW перемикає поведінку: сніжинки повільні, гойдаються й круглі,
 * краплі дощу швидкі, витягнуті й летять навскіс за вітром.
 */
export const precipitationVertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uVolume;
  uniform float uFallSpeed;
  uniform vec2 uWind;
  uniform float uSize;
  uniform float uPixelRatio;

  attribute float aSpeed;
  attribute float aSeed;

  varying float vAlpha;

  void main() {
    vec3 p = position;
    float fall = uTime * aSpeed * uFallSpeed;
    p.y = mod(p.y - fall, uVolume.y) - 2.0;

    #ifdef SNOW
      p.x += sin(uTime * 0.8 + aSeed * 6.283) * 0.8;
      p.z += cos(uTime * 0.6 + aSeed * 4.0) * 0.8;
      vec2 drift = uWind * uTime * 1.5;
    #else
      vec2 drift = uWind * fall * 0.35;
    #endif
    p.xz = mod(p.xz + drift + uVolume.xz * 0.5, uVolume.xz) - uVolume.xz * 0.5;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Обмежуємо розмір, щоб частинки біля самої камери не ставали «пластівцями-тарілками».
    gl_PointSize = min(uSize * uPixelRatio * (30.0 / -mvPosition.z), uSize * uPixelRatio * 1.5);

    // Під водою опадів не видно; далекі частинки м'яко зникають.
    vAlpha = step(0.0, p.y) * smoothstep(90.0, 30.0, -mvPosition.z);
  }
`

export const precipitationFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    #ifdef SNOW
      float shape = smoothstep(0.5, 0.15, length(c));
    #else
      float shape = smoothstep(0.07, 0.0, abs(c.x)) * smoothstep(0.5, 0.1, abs(c.y));
    #endif
    float alpha = shape * vAlpha * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
    #include <colorspace_fragment>
  }
`
