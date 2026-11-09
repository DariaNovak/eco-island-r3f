/**
 * Небесна сфера: градієнт горизонт → зеніт, диск сонця з ореолом,
 * місяць і процедурні зорі, що мерехтять уночі. Спалах блискавки
 * підсвічує все небо. Туман на сферу не діє (fog: false).
 */
export const skyVertexShader = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDirection = normalize(world.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * world;
    // Сфера завжди на дальній площині відсікання.
    gl_Position.z = gl_Position.w;
  }
`

export const skyFragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uNight;
  uniform float uCloud;
  uniform float uFlash;
  uniform float uTime;

  varying vec3 vDirection;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float stars(vec3 dir) {
    vec2 uv = vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0))) * 90.0;
    vec2 cell = floor(uv);
    float h = hash(cell);
    if (h < 0.975) return 0.0;
    vec2 offset = vec2(hash(cell + 7.1), hash(cell + 3.7)) - 0.5;
    float d = length(fract(uv) - 0.5 - offset * 0.6);
    float twinkle = 0.6 + 0.4 * sin(uTime * (1.5 + h * 4.0) + h * 40.0);
    return smoothstep(0.12, 0.0, d) * twinkle;
  }

  void main() {
    vec3 dir = normalize(vDirection);
    float h = dir.y;

    vec3 color = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.65, h), 0.7));
    // Нижче горизонту небо темнішає (видно лише над туманом на краях).
    color = mix(color, uHorizon * 0.6, smoothstep(0.0, -0.25, h));

    float clearSky = 1.0 - uCloud * 0.85;
    float sunDot = dot(dir, uSunDirection);
    float sunUp = smoothstep(-0.1, 0.05, uSunDirection.y);
    color += uSunColor * smoothstep(0.9992, 0.9996, sunDot) * 4.0 * clearSky * sunUp;
    color += uSunColor * pow(max(sunDot, 0.0), 48.0) * 0.45 * clearSky * sunUp;

    float moonDot = dot(dir, -uSunDirection);
    float moonUp = smoothstep(-0.05, 0.1, -uSunDirection.y);
    color += vec3(0.85, 0.9, 1.0) * smoothstep(0.9990, 0.9994, moonDot) * 1.6 * clearSky * moonUp;
    color += vec3(0.4, 0.5, 0.8) * pow(max(moonDot, 0.0), 80.0) * 0.25 * clearSky * moonUp;

    color += vec3(1.0) * stars(dir) * uNight * clearSky * smoothstep(0.0, 0.2, h);
    color += vec3(0.7, 0.75, 0.95) * uFlash * 0.9;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
