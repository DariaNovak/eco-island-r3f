import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, Color, ShaderMaterial, Vector3, type BufferGeometry, type Mesh } from 'three'
import { skyFragmentShader, skyVertexShader } from '../shaders/sky'
import { environment, sky, sunDirection } from '../store/runtime'
import { useDisposable } from '../hooks/useDisposable'

const noRaycast = () => null

const createSkyMaterial = () =>
  new ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new Color() },
      uHorizon: { value: new Color() },
      uSunDirection: { value: new Vector3() },
      uSunColor: { value: new Color() },
      uNight: { value: 0 },
      uCloud: { value: 0 },
      uFlash: { value: 0 },
      uTime: { value: 0 },
    },
  })

/** Небесна сфера з власним шейдером: градієнт, сонце, місяць, зорі, спалахи блискавок. */
export function SkyDome() {
  const mesh = useRef<Mesh<BufferGeometry, ShaderMaterial>>(null)
  const material = useDisposable(createSkyMaterial)

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const u = m.material.uniforms
    u.uTop.value.copy(sky.skyTop)
    u.uHorizon.value.copy(sky.skyHorizon)
    u.uSunDirection.value.copy(sunDirection)
    u.uSunColor.value.copy(sky.sun)
    u.uNight.value = 1 - environment.daylight
    u.uCloud.value = environment.cloud
    u.uFlash.value = environment.lightning
    u.uTime.value = environment.elapsed
  })

  return (
    <mesh ref={mesh} material={material} raycast={noRaycast} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  )
}
