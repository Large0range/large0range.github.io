import { color, Fn, If, instanceIndex, instancedArray, texture, textureLoad, textureStore, uint, uniform, uvec2, vec2, vec4, bool, Loop } from "three/tsl";
import { Camera, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, StorageTexture, Vector2, WebGPURenderer } from "three/webgpu";

const WIDTH = 800;
const HEIGHT = 600;

export async function initFallingSand(container) {
  if (!navigator.gpu) {
    console.log("WebGPU not supported in this browser")
    return;
  } else {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
      console.log("WebGPU supported but no adapter available")
      return;
    } else {
      console.log("WebGPU ready")
    }
  }

  //--------- SETUP CANVAS --------------
  const renderer = new WebGPURenderer();
  await renderer.init();

  renderer.setSize(WIDTH, HEIGHT);
  renderer.setPixelRatio(1);

  container.appendChild(renderer.domElement);


  //-------- SETUP SIMULATION -----------
  const displayTexture = new StorageTexture(WIDTH, HEIGHT);

  const sandParticles = instancedArray(WIDTH * HEIGHT, 'vec4');
  const sandCount = uniform(0, 'uint');

  const mousePos = uniform(new Vector2(0,0), 'vec2');
  const mouseDown = uniform(false, 'bool');

  const displayClear = Fn(() => {
    const posX = instanceIndex.mod(WIDTH);
    const posY = instanceIndex.div(WIDTH);


    textureStore(displayTexture, uvec2(posX, posY), vec4(0.9, 0.9, 0.9, 1)).toWriteOnly();
  })().compute(WIDTH * HEIGHT);

  const updateSand = Fn(() => {
    If(instanceIndex.lessThan(sandCount), () => {
      const currentX = sandParticles.element(instanceIndex).x;
      const currentY = sandParticles.element(instanceIndex).y;
      const belowParticle = bool(false).toVar();
      const leftParticle = bool(false).toVar();
      const rightParticle = bool(false).toVar();
      Loop(sandCount, ({ i }) => {
        const loopParticle = sandParticles.element(i);
        If(loopParticle.y.equal(currentY.sub(1)).and(loopParticle.x.equal(currentX)), () => {
          belowParticle.assign(true);
        }).ElseIf(loopParticle.y.equal(currentY.sub(1)).and(loopParticle.x.equal(currentX.sub(1))), () => {
          leftParticle.assign(true);
        }).ElseIf(loopParticle.y.equal(currentY.sub(1)).and(loopParticle.x.equal(currentX.add(1))), () => {
          rightParticle.assign(true);
        })
      })

      If(currentY.notEqual(0), () => {
        If(belowParticle.not(), () => {
          sandParticles.element(instanceIndex).addAssign(vec4(0, -1, 0, 1));
        }).ElseIf(leftParticle.not(), () => {
          sandParticles.element(instanceIndex).addAssign(vec4(-1, -1, 0, 1));
        }).ElseIf(rightParticle.not(), () => {
          sandParticles.element(instanceIndex).addAssign(vec4(1, -1, 0, 1));
        })
      })
    })
  })().compute(WIDTH * HEIGHT);

  const displaySand = Fn(() => {
    If(instanceIndex.lessThan(sandCount), () => {
      const sx = sandParticles.element(instanceIndex).x;
      const sy = sandParticles.element(instanceIndex).y;
      textureStore(displayTexture, uvec2(sx, sy), vec4(1,0,0,1)).toWriteOnly();
    })


  })().compute(WIDTH * HEIGHT);


  const addNext = Fn(() => {
    sandParticles.element(sandCount).assign(vec4(mousePos, 0, 0));
    sandParticles.element(sandCount.add(1)).assign(vec4(mousePos.x.sub(1), mousePos.y, 0, 0));
    sandParticles.element(sandCount.add(2)).assign(vec4(mousePos.x.sub(1), mousePos.y.sub(1), 0, 0));
    sandParticles.element(sandCount.add(3)).assign(vec4(mousePos.x, mousePos.y.sub(1), 0, 0));
  })().compute(1);


  //-------- SETUP SCENE ----------------

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const plane = new PlaneGeometry(2, 2);
  const material = new MeshBasicNodeMaterial();
  const outputTextureNode = texture(displayTexture);
  material.colorNode = outputTextureNode;
  const mesh = new Mesh(plane, material);
  scene.add(mesh);
  mesh.frustumCulled = false;

  //clear the display texture
  renderer.compute(displayClear);



  const down = (event) => {
    mouseDown.value = true;
  }
  const up = (event) => {
    mouseDown.value = false;
  }
  const move = (event) => {
    mousePos.value.set(event.offsetX, HEIGHT - event.offsetY);
  }
  renderer.domElement.addEventListener("mousemove", move)
  renderer.domElement.addEventListener("mousedown", down);
  renderer.domElement.addEventListener("mouseup", up)


  let swapflag = true;
  renderer.setAnimationLoop((now) => {
    if (mouseDown.value) {
      renderer.compute(addNext);
      sandCount.value += 4;
    }

    renderer.compute(displayClear);
    renderer.compute(updateSand);
    renderer.compute(displaySand);
    renderer.render(scene, camera)

    swapflag = !swapflag;
  });

  return () => {
    displayTexture.dispose();

    renderer.setAnimationLoop(null);
    renderer.dispose();

    renderer.domElement.removeEventListener("mousedown", down);
    renderer.domElement.removeEventListener("mouseup", up);
    renderer.domElement.removeEventListener("mousemove", move);

    container.removeChild(renderer.domElement);
  }

}
