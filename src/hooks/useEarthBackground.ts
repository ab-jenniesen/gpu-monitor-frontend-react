import { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'

interface EarthSceneRef {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  earthMesh: THREE.Mesh
  cloudMesh: THREE.Mesh
  animationFrameId: number
  targetRotationX: number
  targetRotationY: number
  mouseXOnMouseDown: number
  mouseYOnMouseDown: number
  windowHalfX: number
  windowHalfY: number
}

export function useEarthBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<EarthSceneRef | null>(null)

  const createCircleTexture = useCallback((size: number, color: string) => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')!

    const centerX = size / 2
    const centerY = size / 2
    const radius = size / 2

    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
    gradient.addColorStop(0.3, color)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

    context.fillStyle = gradient
    context.beginPath()
    context.arc(centerX, centerY, radius, 0, Math.PI * 2)
    context.fill()

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }, [])

  const createStars = useCallback((
    scene: THREE.Scene,
    count: number,
    size: number,
    opacity: number,
    minDistance: number,
    color: number,
    textureSize: number,
    textureColor: string
  ) => {
    const geometry = new THREE.BufferGeometry()
    const material = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity,
      sizeAttenuation: true,
      map: createCircleTexture(textureSize, textureColor),
      alphaTest: 0.1,
      blending: THREE.AdditiveBlending
    })

    const vertices: number[] = []
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 100
      const y = (Math.random() - 0.5) * 100
      const z = (Math.random() - 0.5) * 100
      if (Math.sqrt(x * x + y * y + z * z) > minDistance) {
        vertices.push(x, y, z)
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    scene.add(new THREE.Points(geometry, material))
  }, [createCircleTexture])

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current

    // 场景
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x030508)

    // 渲染器
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)

    // 相机
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0.20, 0.25, 2.70)

    // 地球
    const textureLoader = new THREE.TextureLoader()
    const earthGeometry = new THREE.SphereGeometry(0.8, 64, 64)
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: textureLoader.load('/assets/earth/earthmap.jpg'),
      bumpMap: textureLoader.load('/assets/earth/earthbump.jpg'),
      bumpScale: 0.1,
      specular: new THREE.Color('#2d4ea3'),
      shininess: 5
    })
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial)
    earthMesh.rotation.set(0.1, Math.PI * 1.5, 0)
    earthMesh.position.set(0, 0.3, 0)
    scene.add(earthMesh)

    // 云层
    const cloudGeometry = new THREE.SphereGeometry(0.82, 64, 64)
    const cloudMaterial = new THREE.MeshPhongMaterial({
      map: textureLoader.load('/assets/earth/earthclouds.jpg'),
      transparent: true,
      opacity: 0.4
    })
    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial)
    cloudMesh.position.set(0, 0.3, 0)
    cloudMesh.rotation.x = 0.1
    scene.add(cloudMesh)

    // 星星
    createStars(scene, 10000, 0.025, 0.7, 5, 0xffffff, 32, '#ffffff')
    createStars(scene, 300, 0.15, 1.0, 5, 0xffffff, 64, '#ffffff')
    createStars(scene, 50, 0.25, 1.0, 10, 0xccf5ff, 128, '#ccf5ff')

    // 光源
    const sunLight = new THREE.DirectionalLight(0xffffff, 2)
    sunLight.position.set(5, 2, 5)
    scene.add(sunLight)
    scene.add(new THREE.AmbientLight(0x333333))
    const pointLight = new THREE.PointLight(0x3366ff, 1, 10)
    pointLight.position.set(-3, 2, -3)
    scene.add(pointLight)

    // 保存引用
    sceneRef.current = {
      scene, camera, renderer, earthMesh, cloudMesh,
      animationFrameId: 0,
      targetRotationX: 0.0005,
      targetRotationY: 0.0002,
      mouseXOnMouseDown: 0,
      mouseYOnMouseDown: 0,
      windowHalfX: window.innerWidth / 2,
      windowHalfY: window.innerHeight / 2
    }

    // 动画
    const yAxis = new THREE.Vector3(0, 1, 0)
    const xAxis = new THREE.Vector3(1, 0, 0)

    const animate = () => {
      const s = sceneRef.current!
      s.animationFrameId = requestAnimationFrame(animate)
      earthMesh.rotation.y += 0.0005
      cloudMesh.rotation.y += 0.0007
      earthMesh.rotateOnWorldAxis(yAxis, s.targetRotationX)
      earthMesh.rotateOnWorldAxis(xAxis, s.targetRotationY)
      cloudMesh.rotateOnWorldAxis(yAxis, s.targetRotationX)
      cloudMesh.rotateOnWorldAxis(xAxis, s.targetRotationY)
      renderer.render(scene, camera)
    }
    animate()

    // 事件
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      if (sceneRef.current) {
        sceneRef.current.windowHalfX = window.innerWidth / 2
        sceneRef.current.windowHalfY = window.innerHeight / 2
      }
    }

    const dragFactor = 0.00005

    const onMouseMove = (event: MouseEvent) => {
      if (!sceneRef.current) return
      const s = sceneRef.current
      s.targetRotationX = (event.clientX - s.windowHalfX - s.mouseXOnMouseDown) * dragFactor
      s.targetRotationY = (event.clientY - s.windowHalfY - s.mouseYOnMouseDown) * dragFactor
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    const onMouseDown = (event: MouseEvent) => {
      const loginCard = document.querySelector('.login-card')
      if (loginCard && (event.target === loginCard || loginCard.contains(event.target as Node))) return
      event.preventDefault()
      if (!sceneRef.current) return
      sceneRef.current.mouseXOnMouseDown = event.clientX - sceneRef.current.windowHalfX
      sceneRef.current.mouseYOnMouseDown = event.clientY - sceneRef.current.windowHalfY
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousedown', onMouseDown)
    window.addEventListener('resize', handleResize)

    // 清理
    return () => {
      if (sceneRef.current) cancelAnimationFrame(sceneRef.current.animationFrameId)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('resize', handleResize)
      scene.traverse((object: any) => {
        if (object.geometry) object.geometry.dispose()
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((m: THREE.Material) => m.dispose())
          } else {
            object.material.dispose()
          }
        }
      })
      renderer.dispose()
      sceneRef.current = null
    }
  }, [createStars])

  return canvasRef
}
