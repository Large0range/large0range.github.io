import { color, Fn, If, instanceIndex, instancedArray, texture, textureLoad, textureStore, uint, uniform, uvec2, vec2, vec4, bool, Loop, atomicAdd, atomicSub, atomicStore, float } from "three/tsl";
import { Camera, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, StorageTexture, Vector2, WebGPURenderer } from "three/webgpu";


const PARTICLES_PER_CLICK = 200;
const REMOVE_RADIUS = 6;



// cheap 2D hash -> pseudo-random 0..1, used to give each spawned particle
// a stable per-particle hue jitter based on its spawn position
function hash21(x, y) {
  return x.mul(12.9898).add(y.mul(78.233)).sin().mul(43758.5453).fract();
}

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


  const WIDTH = window.innerWidth;
  const HEIGHT = window.innerHeight;
  const MAX_PARTICLES = WIDTH * HEIGHT;

  const TIERS = [1024, 4096, 16384, 65536, 262144, MAX_PARTICLES];
  function pickTier(n) {
    for (const t of TIERS) if (n <= t) return t;
    return MAX_PARTICLES;
  }


  const renderer = new WebGPURenderer();
  await renderer.init();
  renderer.setSize(WIDTH, HEIGHT);
  renderer.setPixelRatio(1);
  container.appendChild(renderer.domElement);

  //-------- SETUP SIMULATION -----------
  //WIDTH = window.innerWidth;
  //HEIGHT = window.innerHeight;

  const displayTexture = new StorageTexture(WIDTH, HEIGHT);

  let addSide = Math.sqrt(PARTICLES_PER_CLICK);
  let hAddSide = addSide / 2;

  // vec4 layout: (x, y, hue jitter 0..1, alive) — alive: 1 = live, 0 = dead/empty
  const sandParticlesA = instancedArray(MAX_PARTICLES, 'vec4');
  const sandParticlesB = instancedArray(MAX_PARTICLES, 'vec4');

  const occupancy = instancedArray(WIDTH * HEIGHT, 'uint').toAtomic();

  const sandCount = uniform(0, 'uint');
  const mousePos = uniform(new Vector2(0, 0), 'vec2');
  const leftDown = uniform(false, 'bool');
  const rightDown = uniform(false, 'bool');

  const fullClear = Fn(() => {
    const posX = instanceIndex.mod(WIDTH);
    const posY = instanceIndex.div(WIDTH);
    textureStore(displayTexture, uvec2(posX, posY), vec4(0,0,0, 1)).toWriteOnly();
  })().compute(WIDTH * HEIGHT);

  const occupancyInit = Fn(() => {
    atomicStore(occupancy.element(instanceIndex), uint(0));
  })().compute(WIDTH * HEIGHT);

  function clearDirtyKernel(buf) {
    return Fn(() => {
      If(instanceIndex.lessThan(sandCount), () => {
        If(buf.element(instanceIndex).w.equal(1), () => {
          const sx = buf.element(instanceIndex).x;
          const sy = buf.element(instanceIndex).y;
          textureStore(displayTexture, uvec2(sx, sy), vec4(0,0,0, 1)).toWriteOnly();
        });
      });
    });
  }

  // atomic-ticket claim for movement — unchanged except `z` (hue jitter) is
  // now carried over to dst instead of being reset to 0 on every move
  function updateSandKernel(src, dst) {
    return Fn(() => {
      If(instanceIndex.lessThan(sandCount), () => {
        If(src.element(instanceIndex).w.equal(1), () => {
          const currentX = src.element(instanceIndex).x;
          const currentY = src.element(instanceIndex).y;
          const currentZ = src.element(instanceIndex).z;

          const destX = currentX.toVar();
          const destY = currentY.toVar();
          const claimed = bool(false).toVar();

          If(currentY.notEqual(0), () => {
            const belowIdx = uint(currentY.sub(1).mul(WIDTH).add(currentX));
            const belowOld = atomicAdd(occupancy.element(belowIdx), uint(1));
            If(belowOld.equal(uint(0)), () => {
              destX.assign(currentX);
              destY.assign(currentY.sub(1));
              claimed.assign(true);
            }).Else(() => {
              atomicSub(occupancy.element(belowIdx), uint(1));
            });

            If(claimed.not().and(currentX.greaterThan(0)), () => {
              const leftIdx = uint(currentY.sub(1).mul(WIDTH).add(currentX.sub(1)));
              const leftOld = atomicAdd(occupancy.element(leftIdx), uint(1));
              If(leftOld.equal(uint(0)), () => {
                destX.assign(currentX.sub(1));
                destY.assign(currentY.sub(1));
                claimed.assign(true);
              }).Else(() => {
                atomicSub(occupancy.element(leftIdx), uint(1));
              });
            });

            If(claimed.not().and(currentX.lessThan(WIDTH - 1)), () => {
              const rightIdx = uint(currentY.sub(1).mul(WIDTH).add(currentX.add(1)));
              const rightOld = atomicAdd(occupancy.element(rightIdx), uint(1));
              If(rightOld.equal(uint(0)), () => {
                destX.assign(currentX.add(1));
                destY.assign(currentY.sub(1));
                claimed.assign(true);
              }).Else(() => {
                atomicSub(occupancy.element(rightIdx), uint(1));
              });
            });

            If(claimed, () => {
              atomicSub(occupancy.element(uint(currentY.mul(WIDTH).add(currentX))), uint(1));
            });
          });

          // z (hue jitter) carried over unchanged — was previously hardcoded
          // to 0 here, which wiped out spawn-time hue on a particle's first move
          dst.element(instanceIndex).assign(vec4(destX, destY, currentZ, 1));
        }).Else(() => {
          dst.element(instanceIndex).assign(vec4(0, 0, 0, 0));
        });
      });
    });
  }

  // color now varies per-particle using the hue jitter stored in `z`,
  // instead of a flat vec4(1, 0, 0, 1) for every particle
  function displaySandKernel(buf) {
    return Fn(() => {
      If(instanceIndex.lessThan(sandCount), () => {
        If(buf.element(instanceIndex).w.equal(1), () => {
          const sx = buf.element(instanceIndex).x;
          const sy = buf.element(instanceIndex).y;
          const z = buf.element(instanceIndex).z;

          // warm sandy palette, jittered per-particle by z (0..1)
          const r = float(0.80).add(z.mul(0.18));
          const g = float(0.55).add(z.mul(0.28));
          const b = float(0.25).add(z.mul(0.18));

          textureStore(displayTexture, uvec2(sx, sy), vec4(r, g, b, 1)).toWriteOnly();
        });
      });
    });
  }

  function removeSandKernel(buf) {
    return Fn(() => {
      If(instanceIndex.lessThan(sandCount), () => {
        If(buf.element(instanceIndex).w.equal(1), () => {
          const px = buf.element(instanceIndex).x;
          const py = buf.element(instanceIndex).y;
          const dx = px.sub(mousePos.x);
          const dy = py.sub(mousePos.y);
          const distSq = dx.mul(dx).add(dy.mul(dy));
          If(distSq.lessThanEqual(REMOVE_RADIUS * REMOVE_RADIUS), () => {
            atomicSub(occupancy.element(uint(py.mul(WIDTH).add(px))), uint(1));
            buf.element(instanceIndex).assign(vec4(0, 0, 0, 0));
          });
        });
      });
    });
  }

  function buildTiers(kernelFn) {
    const dict = {};
    for (const t of TIERS) dict[t] = kernelFn().compute(t);
    return dict;
  }

  const clearDirtyA = buildTiers(clearDirtyKernel(sandParticlesA));
  const clearDirtyB = buildTiers(clearDirtyKernel(sandParticlesB));

  const updateSandAtoB = buildTiers(updateSandKernel(sandParticlesA, sandParticlesB));
  const updateSandBtoA = buildTiers(updateSandKernel(sandParticlesB, sandParticlesA));

  const displaySandA = buildTiers(displaySandKernel(sandParticlesA));
  const displaySandB = buildTiers(displaySandKernel(sandParticlesB));

  const removeSandA = buildTiers(removeSandKernel(sandParticlesA));
  const removeSandB = buildTiers(removeSandKernel(sandParticlesB));

  // spawn now writes hash21(px, py) into z instead of a fixed 0, giving
  // each particle in the block a stable, distinct hue based on where it landed
  function makeAddNext(buf) {
    return Fn(() => {
      Loop({ start: -hAddSide, end: hAddSide }, { start: -hAddSide, end: hAddSide }, ({ i, j }) => {
        const px = mousePos.x.add(i);
        const py = mousePos.y.add(j);
        const slot = i.add(hAddSide).mul(addSide).add(j.add(hAddSide));

        const inBounds = px.greaterThanEqual(0).and(px.lessThan(WIDTH))
          .and(py.greaterThanEqual(0)).and(py.lessThan(HEIGHT));

        If(inBounds, () => {
          const idx = uint(py.mul(WIDTH).add(px));
          const oldVal = atomicAdd(occupancy.element(idx), uint(1));
          If(oldVal.equal(uint(0)), () => {
            buf.element(sandCount.add(slot)).assign(vec4(px, py, hash21(px, py), 1));
          }).Else(() => {
            atomicSub(occupancy.element(idx), uint(1));
            buf.element(sandCount.add(slot)).assign(vec4(0, 0, 0, 0));
          });
        }).Else(() => {
          buf.element(sandCount.add(slot)).assign(vec4(0, 0, 0, 0));
        });
      });
    })().compute(1);
  }

  const addNextA = makeAddNext(sandParticlesA);
  const addNextB = makeAddNext(sandParticlesB);

  //-------- SETUP SCENE ----------------
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const plane = new PlaneGeometry(2, 2);
  const material = new MeshBasicNodeMaterial();
  material.colorNode = texture(displayTexture);
  const mesh = new Mesh(plane, material);
  scene.add(mesh);
  mesh.frustumCulled = false;

  renderer.compute(fullClear);
  renderer.compute(occupancyInit);

  const down = (event) => {
    if (event.button === 0) leftDown.value = true;
    else if (event.button === 2) rightDown.value = true;
  }
  const up = (event) => {
    if (event.button === 0) leftDown.value = false;
    else if (event.button === 2) rightDown.value = false;
  }
  const move = (event) => { mousePos.value.set(event.offsetX, HEIGHT - event.offsetY); }
  const blockContextMenu = (event) => event.preventDefault();

  renderer.domElement.addEventListener("mousemove", move)
  renderer.domElement.addEventListener("mousedown", down);
  renderer.domElement.addEventListener("mouseup", up)
  renderer.domElement.addEventListener("contextmenu", blockContextMenu);

  let sourceIsA = true;

  renderer.setAnimationLoop(() => {
    const clearTier = pickTier(sandCount.value);
    renderer.compute(sourceIsA ? clearDirtyA[clearTier] : clearDirtyB[clearTier]);

    if (leftDown.value && sandCount.value + PARTICLES_PER_CLICK <= MAX_PARTICLES) {
      renderer.compute(sourceIsA ? addNextA : addNextB);
      sandCount.value += PARTICLES_PER_CLICK;
    }

    if (rightDown.value) {
      const removeTier = pickTier(sandCount.value);
      renderer.compute(sourceIsA ? removeSandA[removeTier] : removeSandB[removeTier]);
    }

    const workTier = pickTier(sandCount.value);
    renderer.compute(sourceIsA ? updateSandAtoB[workTier] : updateSandBtoA[workTier]);
    renderer.compute(sourceIsA ? displaySandB[workTier] : displaySandA[workTier]);

    renderer.render(scene, camera)
    sourceIsA = !sourceIsA;
  });

  return () => {
    displayTexture.dispose();
    renderer.setAnimationLoop(null);
    renderer.dispose();
    renderer.domElement.removeEventListener("mousedown", down);
    renderer.domElement.removeEventListener("mouseup", up);
    renderer.domElement.removeEventListener("mousemove", move);
    renderer.domElement.removeEventListener("contextmenu", blockContextMenu);
    container.removeChild(renderer.domElement);
  }
}
