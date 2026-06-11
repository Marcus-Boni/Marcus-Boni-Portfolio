/**
 * "Ink Field" — the hero shader. A slow field of layered simplex-fbm ink
 * currents over the page's near-black, with ember-colored signal veins that
 * intensify with pointer proximity and scroll velocity.
 */

export const inkFieldVertex = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

export const inkFieldFragment = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;     // NDC, smoothed on the JS side
  uniform float uVelocity;   // normalized |scroll velocity| 0..1
  uniform float uReveal;     // 0..1 intro reveal
  uniform vec3 uInk;
  uniform vec3 uBone;
  uniform vec3 uEmber;

  varying vec2 vUv;

  // ── simplex noise (Ashima / IQ) ────────────────────────────
  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int i = 0; i < 4; i++) {
      value += amplitude * snoise(p);
      p = p * 2.05 + vec2(13.7, 7.3);
      amplitude *= 0.48;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 p = (uv - 0.5) * aspect;

    float t = uTime * 0.04;
    float energy = 0.22 + uVelocity * 1.0;

    // pointer influence — a soft well that bends the field
    vec2 pointer = uPointer * aspect * 0.5;
    float pd = length(p - pointer);
    float pull = exp(-pd * 3.2) * 0.6;

    // domain-warped ink currents — low frequency, slow drift
    vec2 q = vec2(
      fbm(p * 0.85 + t),
      fbm(p * 0.85 - t * 0.8 + 4.0)
    );
    vec2 r = vec2(
      fbm(p * 1.1 + q * (1.3 + uVelocity * 0.6) + vec2(1.7, 9.2) + t * 0.6),
      fbm(p * 1.1 + q * (1.3 + uVelocity * 0.6) + vec2(8.3, 2.8) - t * 0.4)
    );
    float field = fbm(p * (0.9 + pull * 0.5) + r * energy + pointer * pull * 0.6);

    // base ink wash — barely-there tonal movement
    float wash = smoothstep(-0.7, 0.9, field);
    vec3 color = mix(uInk, uInk * 1.7 + uBone * 0.03, wash * 0.4);

    // ember signal veins — sparse ridges that ignite near the pointer
    float vein = 1.0 - abs(field * 2.0 - 0.2);
    vein = smoothstep(0.93 - uVelocity * 0.1 - pull * 0.14, 1.0, vein);
    color += uEmber * vein * (0.16 + pull * 0.9 + uVelocity * 0.45);

    // faint bone dust in the highlights
    float dust = smoothstep(0.62, 1.0, r.x) * 0.03;
    color += uBone * dust;

    // vignette to seat the canvas into the page
    float vig = smoothstep(1.25, 0.35, length(p));
    color *= mix(0.75, 1.0, vig);

    // intro reveal — ink floods in from black
    color = mix(uInk, color, uReveal);

    gl_FragColor = vec4(color, 1.0);
  }
`
