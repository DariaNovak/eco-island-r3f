import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { ACESFilmicToneMapping } from 'three'
import { CAMERA } from './config'
import { Experience } from './scene/Experience'
import { Hud } from './ui/Hud'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

export default function App() {
  useKeyboardShortcuts()

  return (
    <>
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: CAMERA.position, fov: CAMERA.fov, near: 0.1, far: 900 }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}
      >
        <Experience />
        <AdaptiveDpr pixelated />
      </Canvas>
      <Hud />
    </>
  )
}
