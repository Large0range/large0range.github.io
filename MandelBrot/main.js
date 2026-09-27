import { color, Fn, If, instanceIndex, instancedArray, texture, textureLoad, textureStore, uint, uniform, uvec2, vec2, vec4, bool, Loop, atomicAdd, atomicSub, atomicStore, float, uv, oscSine, time, Break, vec3, screenUV } from "three/tsl";
import { Camera, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, StorageTexture, Vector2, WebGPURenderer } from "three/webgpu";

export async function initMandelBrot(container) {
  // ------------ SETUP RENDERER --------------------
  const WIDTH = window.innerWidth;
  const HEIGHT = window.innerHeight;

  const renderer = new WebGPURenderer();
  renderer.setSize(WIDTH, HEIGHT);
  renderer.setPixelRatio(1);
  renderer.init();

  container.appendChild(renderer.domElement);

  // ----------- SETUP SIMULATION ------------------
  const mandelbrot = Fn(() => {
    const centerReal = -0.743643887037151;
    const centerImag = 0.13182590420533;

    const cycleLength = 40.0; // tune to just before visual breakdown
    const t = time.mod(cycleLength);

    // zoom grows exponentially with time — halves the view every ~2 seconds
    const zoomSpeed = 0.35;

    const viewHeight = float(2.5).mul(t.mul(-zoomSpeed).exp());

    const aspect = float(WIDTH).div(HEIGHT);
    const viewWidth = viewHeight.mul(aspect);

    const cReal = float(centerReal).add(screenUV.x.sub(0.5).mul(viewWidth));
    const cImag = float(centerImag).add(screenUV.y.sub(0.5).mul(viewHeight));
    const c = vec2(cReal, cImag);

    const z = vec2(0, 0).toVar();
    let iter = float(0).toVar();

    Loop(200, ({ i }) => {
      const x = z.x.mul(z.x).sub(z.y.mul(z.y));
      const y = z.x.mul(z.y).mul(2.0);
      z.assign(vec2(x, y).add(c));

      If(z.length().greaterThan(2.0), () => {
        iter.assign(i.toFloat());
        Break();
      });
    });

    let finalColor = vec4(vec3(iter.div(200)), 1).toVar();
    return finalColor;
  })();

  const julia = Fn( () => {

	// Scale and center screen UV coordinates
	const z = screenUV.sub( 0.5 ).mul( 3.0 );

	// Animate the complex constant c over time
	const c = vec2( time.cos().mul( 0.3 ).sub( 0.7 ), time.sin().mul( 0.2 ).add( 0.27015 ) );
	const iterations = float( 0.0 );

	// Loop 32 times to calculate the fractal escape depth
	Loop( 32, ( { i } ) => {

		// Complex number square: z = z^2 + c
		const x = z.x.mul( z.x ).sub( z.y.mul( z.y ) );
		const y = z.x.mul( z.y ).mul( 2.0 );
		z.assign( vec2( x, y ).add( c ) );

		// Break early if the point escapes the threshold
		If( z.length().greaterThan( 2.0 ), () => {

			iterations.assign( i.toFloat() );
			Break();

		} );

	} );

	// Return normalized value based on loop iterations
	return iterations.div( 32.0 );

  } )();

  // ------------ SETUP SCENE ----------------------
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const plane = new PlaneGeometry(2, 2);
  const material = new MeshBasicNodeMaterial();
  material.fragmentNode = mandelbrot;
  const mesh = new Mesh(plane, material);
  scene.add(mesh);
  mesh.frustumCulled = false;


  renderer.setAnimationLoop((now) => {
    renderer.render(scene, camera);
  })

  return () => {
    renderer.setAnimationLoop(null);

    renderer.dispose();
    renderer.forceContextLoss();
  }
}
