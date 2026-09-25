import { color, Fn, If, instanceIndex, texture, textureLoad, textureStore, uint, uniform, uvec2, vec2, vec4 } from "three/tsl";
import { Camera, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, StorageTexture, Vector2, WebGPURenderer } from "three/webgpu";

const WIDTH = 800;
const HEIGHT = 600;
const BLOCK_SIZE = 10;

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
  const textureA = new StorageTexture(WIDTH, HEIGHT); // CHANGE TO BE / BLOCK_SIZE
  const textureB = new StorageTexture(WIDTH, HEIGHT); // CHANGE TO BE / BLOCK_SIZE

  const mousePos = uniform(new Vector2(0,0), 'vec2');
  const mouseDown = uniform(false, 'bool');

  const initBNode = Fn(() => {
    const posX = instanceIndex.mod(WIDTH);
    const posY = instanceIndex.div(WIDTH);

    textureStore(textureB, uvec2(posX, posY), vec4(1, 1, 1, 1)).toWriteOnly();
  })().compute(WIDTH * HEIGHT);

  const testANode = Fn(() => {
    const posX = instanceIndex.mod(WIDTH);
    const posY = instanceIndex.div(WIDTH);

    const col = textureLoad(textureB, uvec2(posX, posY)).toVar();

    textureStore(textureA, uvec2(posX, posY), col);

    If(mouseDown.and(mousePos.div(BLOCK_SIZE).floor().equal(vec2(posX.toFloat(), posY.toFloat()).div(BLOCK_SIZE).floor()).all()), () => {
      textureStore(textureA, uvec2(posX, posY), vec4(1, 0, 0, 1)).toWriteOnly();
    })



    If(posX.mod(BLOCK_SIZE).equal(0), () => {
      textureStore(textureA, uvec2(posX, posY), vec4(0, 0, 0, 1)).toWriteOnly();
    })


    If(posY.mod(BLOCK_SIZE).equal(0), () => {
      textureStore(textureA, uvec2(posX, posY), vec4(0,0,0, 1)).toWriteOnly();
    })

  })().compute(WIDTH * HEIGHT);



  const testBNode = Fn(() => {
    const posX = instanceIndex.mod(WIDTH);
    const posY = instanceIndex.div(WIDTH);


    const col = textureLoad(textureA, uvec2(posX, posY)).toVar();

    textureStore(textureB, uvec2(posX, posY), col);

    If(mouseDown.and(mousePos.div(BLOCK_SIZE).floor().equal(vec2(posX.toFloat(), posY.toFloat()).div(BLOCK_SIZE).floor()).all()), () => {
      textureStore(textureB, uvec2(posX, posY), vec4(1, 0, 0, 1)).toWriteOnly();
    })

    If(posX.mod(BLOCK_SIZE).equal(0), () => {
      textureStore(textureB, uvec2(posX, posY), vec4(0,0,0, 1)).toWriteOnly();
    })

    If(posY.mod(BLOCK_SIZE).equal(0), () => {
      textureStore(textureB, uvec2(posX, posY), vec4(0,0,0, 1)).toWriteOnly();
    })

  })().compute(WIDTH * HEIGHT);

  //-------- SETUP SCENE ----------------

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const plane = new PlaneGeometry(2, 2);
  const material = new MeshBasicNodeMaterial();
  const outputTextureNode = texture(textureA);
  material.colorNode = outputTextureNode;
  const mesh = new Mesh(plane, material);
  scene.add(mesh);
  mesh.frustumCulled = false;

  renderer.compute(initBNode);



  const down = (event) => {
    mouseDown.value = true;
    mousePos.value.set(event.offsetX, HEIGHT - event.offsetY);
  }
  renderer.domElement.addEventListener("mousedown", down);


  let swapflag = true;
  renderer.setAnimationLoop((now) => {
    outputTextureNode.value = swapflag ? textureA : textureB;
    renderer.compute(swapflag ? testANode : testBNode);
    renderer.render(scene, camera)

    swapflag = !swapflag;
  });

  return () => {
    textureA.dispose();
    textureB.dispose();

    renderer.setAnimationLoop(null);
    renderer.dispose();

    renderer.domElement.removeEventListener("mousedown", down);

    container.removeChild(renderer.domElement);
  }

}
