// Open source version of the Site3D library. For more information visit the Site3D official website https://site3d.site

class site3d
{
  static TwoPI = 2 * Math.PI;
  static PI2 = Math.PI / 2;
  static normalizeRad = (angle) => {return Math.abs(angle) == site3d.TwoPI ? angle : angle % site3d.TwoPI;};
  static minRotationAngle = (start, end) =>
  {
    if (Math.abs(start - end) > Math.PI)
      end += (start > 0 ? site3d.TwoPI : -site3d.TwoPI);
    return end;
  };
  static normalizeDeg = (angle) => {return Math.abs(angle) == 360 ? angle : angle % 360;};
  static toRad = (angle) => {return site3d.normalizeDeg(angle) * (Math.PI / 180);};
  static toDeg = (angle) => {return site3d.normalizeRad(angle) * (180 / Math.PI);};
  static mousePos = (e) => {return e.changedTouches !== undefined ? {x:  e.changedTouches[0].clientX, y: e.changedTouches[0].clientY} : {x: e.clientX, y: e.clientY};};
  static fingerDistance(p1, p2) {return (Math.sqrt(Math.pow((p1.clientX - p2.clientX), 2) + Math.pow((p1.clientY - p2.clientY), 2)));}

  static _normalizeRotation = (rotation) =>
  {
    rotation.x = site3d.normalizeRad(rotation.x);
    rotation.y = site3d.normalizeRad(rotation.y);
    rotation.z = site3d.normalizeRad(rotation.z);
  };
  static _minRotation = (startRotation, endRotation) =>
  {
    endRotation.x = site3d.minRotationAngle(startRotation.x, endRotation.x);
    endRotation.y = site3d.minRotationAngle(startRotation.y, endRotation.y);
    endRotation.z = site3d.minRotationAngle(startRotation.z, endRotation.z);
  };
  static _preventDefault(e)
  {
    e = e || window.event;
    if (e.preventDefault)
      e.preventDefault();
    e.returnValue = false;
  }

  ////////////////////
  // Public methods //
  ////////////////////

  constructor(canvas, options)
  {
    this.canvas = typeof canvas == 'string' ? document.getElementById(canvas) : canvas;

    let load = null;
    let alpha = true;
    if (options !== undefined)
    {
      if (options.load !== undefined) load = options.load;
      if (options.alpha !== undefined) alpha = options.alpha;
    }

    this._axis = {x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1)};
    this._preventGlobalEvents = {wheel: false, touchmove: false};

    const webglVersions = ['webgl2', 'webgl'];
    let context = null;
    for (let item of webglVersions)
    {
      context = this.canvas.getContext(item);
      if (context != null)
      {
        this.webglVersion = item;
        break;
      }
    };
    this._renderer = new WebGLRenderer({canvas: this.canvas, context: context, alpha: alpha, antialias: true, preserveDrawingBuffer: true});
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = PCFSoftShadowMap;
    this._renderer.toneMapping = ACESFilmicToneMapping;
    this._renderer.physicallyCorrectLights = true;
    this._renderer.outputEncoding = sRGBEncoding;
    this._scene = new Scene();
    this._models = new Map();
    this._materials = new Map();
    this._lights = new Map();
    this._camera = new PerspectiveCamera();
    this._loadInfo = {countModel: 0, countModelPreload: 0, countModelLoaded: 0, load: load};
    this._camera.rotation.order = 'YXZ';
    this._cameraRotateOptions = {target: new Vector3(0, 0, 0), axe: 'y', isLook: true};

    this.camera({angle: 50, near: 0.1, far: 100, pos: [0, 0, 1]});

    if (this.webglVersion == 'webgl2')
    {
      const renderTargetSize = this._renderer.getDrawingBufferSize(new Vector2());
      const renderTarget = new WebGLMultisampleRenderTarget(renderTargetSize.width, renderTargetSize.height, {format: RGBEFormat, stencilBuffer: false});
      this._composer = new EffectComposer(this._renderer, renderTarget);
    }
    else
      this._composer = new EffectComposer(this._renderer);
    this._renderPass = new RenderPass(this._scene, this._camera);
    this._composer.addPass(this._renderPass);
  }

  preload()
  {
    this._loadInfo.countModelPreload = this._loadInfo.countModel;
    this._callLoad();
  }

  background(color) {this._scene.background = new Color(color);}
  fog(color, near, far) {this._scene.fog = new Fog(color, near, far);}

  plane(name, width, height, fill) {this._models.set(name, new site3dPlane(this, name, width, height, fill));}
  circle(name, radius, detail, fill) {this._models.set(name, new site3dCircle(this, name, radius, detail, fill));}
  cube(name, width, height, depth, fill) {this._models.set(name, new site3dCube(this, name, width, height, depth, fill));}
  sphere(name, radius, detail, fill) {this._models.set(name, new site3dSphere(this, name, radius, detail, fill));}
  hemisphere(name, radius, detail, fill) {this._models.set(name, new site3dHemisphere(this, name, radius, detail, fill));}
  octahedron(name, radius, detail, fill) {this._models.set(name, new site3dOctahedron(this, name, radius, detail, fill));}
  text(name, text, options, fill, load) {this._models.set(name, new site3dText(this, name, text, options, fill, load));}
  model(name) {return this._models.get(name);}

  addFill(name, fill) {this._materials.set(name, this._getFilledMaterial(fill));}

  ambientLight(name, options) {this._lights.set(name, new site3dAmbientLight(this, name, options));}
  directionalLight(name, options) {this._lights.set(name, new site3dDirectionalLight(this, name, options));}
  spotLight(name, options) {this._lights.set(name, new site3dSpotLight(this, name, options));}
  light(name) {return this._lights.get(name);}

  camera(options)
  {
    if (options.angle !== undefined)
      this._camera.fov = options.angle;
    if (options.near !== undefined)
      this._camera.near = options.near;
    if (options.far !== undefined)
      this._camera.far = options.far;
    if (options.pos !== undefined)
      this.cameraPos(options.pos);
    if (options.target !== undefined)
      this.rotateCamera(options.target);
    this._camera.updateProjectionMatrix();
  }
  getCameraPos() {return [this._camera.position.x, this._camera.position.y, this._camera.position.z];}
  cameraPos(p1, p2, p3)
  {
    if (Array.isArray(p1))
      this._camera.position.set(p1[0], p1[1], p1[2]);
    else
    	this._camera.position.set(p1, p2, p3);
  }
  isCameraPos(pos) {return this._camera.position.x == pos[0] && this._camera.position.y == pos[1] && this._camera.position.z == pos[2];}
  moveCamera(p1, p2, p3)
  {
    if (!this._flyParams.isPlay)
    {
      if (p3 === undefined)
      {
        if (p2 === undefined)
        {
          const startPosition = this._camera.position.clone();
          const startRotation = new Euler().copy(this._camera.rotation);
          this._camera.translateZ(p1);
          const target = new Vector3(this._camera.position.x, startPosition.y, this._camera.position.z);
          this._camera.position.copy(startPosition);
          this._camera.lookAt(target);
          this._camera.translateZ(p1 < 0 ? p1 : -p1);
          this._camera.rotation.copy(startRotation);
        }
        else
        {
          const startRotation = new Euler().copy(this._camera.rotation);
          this._camera.lookAt(new Vector3(p2[0], p2[1], p2[2]));
          this._camera.translateZ(-p1);
          this._camera.rotation.copy(startRotation);
        }
      }
      else
      {
        this._camera.translateX(p1);
        this._camera.translateY(p2);
        this._camera.translateZ(p3);
      }
    }
  }
  getCameraRot() {return [site3d.toDeg(this._camera.rotation.x), site3d.toDeg(this._camera.rotation.y), site3d.toDeg(this._camera.rotation.z)];}
  cameraRot(p1, p2, p3)
  {
    if (Array.isArray(p1))
    	this._camera.rotation.set(site3d.toRad(p1[0]), site3d.toRad(p1[1]), site3d.toRad(p1[2]));
    else
    	this._camera.rotation.set(site3d.toRad(p1), site3d.toRad(p2), site3d.toRad(p3));
  }
  rotateCameraWorldRad(stepX, stepY, stepZ)
  {
    this._camera.rotateOnWorldAxis(this._axis.x, stepX);
    this._camera.rotateOnWorldAxis(this._axis.y, stepY);
    this._camera.rotateOnWorldAxis(this._axis.y, stepY);
  }
  rotateCamera(p1, p2, p3)
  {
    if (p3 !== undefined)
    {
      this._camera.rotateX(site3d.toRad(p1));
      this._camera.rotateY(site3d.toRad(p2));
      this._camera.rotateZ(site3d.toRad(p3));
    }
    else
    {
      if (Array.isArray(p1))
      {
        this._camera.lookAt(new Vector3(p1[0], p1[1], p1[2]));
      }
      else
      {
        if (p2 !== undefined)
        {
          if (p2.pos !== undefined)
            this._cameraRotateOptions.target = new Vector3(p2.pos[0], p2.pos[1], p2.pos[2]);
          if (p2.axe !== undefined)
            this._cameraRotateOptions.axe = p2.axe;
          if (p2.isLook !== undefined)
            this._cameraRotateOptions.isLook = p2.isLook;
        }
        const angle = site3d.toRad(p1);
        if (this._cameraRotateOptions.axe == 'y')
        {
          const x0 = this._cameraRotateOptions.target.x;
          const z0 = this._cameraRotateOptions.target.z;
          const x1 = x0 + (this._camera.position.x - x0) * Math.cos(angle) - (this._camera.position.z - z0) * Math.sin(angle);
          const z1 = z0 + (this._camera.position.z - z0) * Math.cos(angle) + (this._camera.position.x - x0) * Math.sin(angle);
          this._camera.position.x = x1;
          this._camera.position.z = z1;
        }
        if (this._cameraRotateOptions.isLook)
          this._camera.lookAt(this._cameraRotateOptions.target);
      }
    }
  }

  render()
  {
    if (this._resize())
    {
      this._camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
      this._camera.updateProjectionMatrix();
      this._composer.setSize(this.canvas.width, this.canvas.height);
    }

    this._composer.render();
  }

  /////////////////////
  // Private methods //
  /////////////////////

  _resize()
  {
    const pixel_ratio = window.devicePixelRatio;
    const width = this.canvas.clientWidth * pixel_ratio | 0;
    const height = this.canvas.clientHeight * pixel_ratio | 0;
    const isNeedResize = this.canvas.width !== width || this.canvas.height !== height;
    if (isNeedResize)
      this._renderer.setSize(width, height, false);
    return isNeedResize;
  }

  _getMaterial(updatedMaterial, type)
  {
    if (updatedMaterial !== undefined && type === undefined)
      return updatedMaterial;
    else if (type === undefined || type == 'physical')
      return new MeshPhysicalMaterial();
    else
    {
      switch (type)
      {
        case 'basic': return new MeshBasicMaterial();
        case 'lambert': return new MeshLambertMaterial();
        case 'phong': return new MeshPhongMaterial();
      }
    }
  }
  _getMaterialTexture(path)
  {
    const loader = new TextureLoader();
    const texture = loader.load(path);
    texture.anisotropy = 2;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.flipY = false;
    return texture;
  }
  _setMaterialOptions(material, options)
  {
    if (options.count !== undefined && material.map != null)
      material.map.repeat.set(options.count, options.count);
    if (options.side !== undefined)
    {
    	switch (options.side)
      {
        case 'inside': material.side = BackSide; break;
        case 'both': material.side = DoubleSide; break;
        default: material.side = FrontSide;
      }
    }
    if (options.color !== undefined) material.color.set(options.color);
    if (options.emissive !== undefined && material.emissive !== undefined) material.emissive.set(options.emissive);
    if (options.shininess !== undefined && material.shininess !== undefined) material.shininess = options.shininess;
    if (options.metalness !== undefined && material.metalness !== undefined) material.metalness = options.metalness;
    if (options.roughness !== undefined && material.roughness !== undefined) material.roughness = options.roughness;
    if (options.blending !== undefined)
    {
      switch (options.blending)
      {
        case 'no': material.blending = NoBlending; break;
        case 'subtractive': material.blending = SubtractiveBlending; break;
        case 'multiply': material.blending = MultiplyBlending; break;
        case 'additive': material.blending = AdditiveBlending; break;
        default: material.blending = NormalBlending;
      }
    }
    if (options.transparent !== undefined) material.transparent = options.transparent;
    if (options.opacity !== undefined) material.opacity = options.opacity;
  }
  _getFilledMaterial(fill, updatedMaterial)
  {
    let material = null;
    if (fill === undefined) fill = '#ffffff';
    if (fill.value === undefined)
    {
      if (typeof fill == 'string')
        fill = {value: fill}
      else
        fill.value = null;
    }
    if (fill.value != null)
    {
      if (this._materials.has(fill.value))
        material = this._materials.get(fill.value);
      else
      {
        material = this._getMaterial(updatedMaterial, fill.type);
        if (typeof fill.value == 'string' && fill.value.indexOf('#') != -1)
          material.color.set(fill.value);
        else if (typeof fill.value == 'string' && (fill.value.indexOf('.jpg') != -1 || fill.value.indexOf('.png') != -1))
        {
          material.map = this._getMaterialTexture(fill.value);
          if (material.emissiveMap != null)
            material.emissiveMap = material.map;
        }
      }
    }
    else
      material = this._getMaterial(updatedMaterial, fill.type);
    this._setMaterialOptions(material, fill);
    return material;
  }
  _updateMaterial(material, fill) {this._getFilledMaterial(fill, material);}

  _callLoad()
  {
    if (this._loadInfo.load != null)
      this._loadInfo.load({countModel: this._loadInfo.countModel, countModelLoaded: this._loadInfo.countModelLoaded, countModelPreload: this._loadInfo.countModelPreload, is_preload_completed: this._loadInfo.countModelPreload != 0 && this._loadInfo.countModelPreload == this._loadInfo.countModelLoaded});
  }

  _addModel(model)
  {
    if (model.OBJECT != null)
    {
      model.OBJECT.rotation.order = 'YXZ';
      this._scene.add(model.OBJECT);
    }
    this._loadInfo.countModelLoaded++;
    this._callLoad();
  }

  _addLight(light)
  {
    if (light.OBJECT != null)
    {
      this._scene.add(light.OBJECT);
      if (light.OBJECT.target !== undefined)
        this._scene.add(light.OBJECT.target);
    }
  }
}

class site3dRender
{
  constructor(s3d)
  {
    this.s3d = s3d;
    this.event = new Event('render');
    this.isStart = true;
  }
  render()
  {
    if (this.isStart)
    {
      this.s3d.render();
      this.s3d.canvas.dispatchEvent(this.event);
    }
  }
  start() {this.isStart = true;}
  stop() {this.isStart = false;}
}

class site3dRenderFull extends site3dRender
{
  constructor(s3d)
  {
    super(s3d);
    const renderCycle = () =>
      {
        requestAnimationFrame(renderCycle);
        this.render();
      }
    renderCycle();
  }
}

class site3dModel
{
  constructor(s3d, name, params)
  {
    this.s3d = s3d;
    this.name = name;
    this.OBJECT = null;
    if (params !== undefined && params.geometry !== undefined)
    {
      this.OBJECT = new Mesh(params.geometry, this.s3d._getFilledMaterial(params.fill));
      this.s3d._addModel(this);
    }
    this.s3d._loadInfo.countModel++;
  }

  isLoaded() {return this.OBJECT != null;}
  hide()
  {
    this.OBJECT.visible = false;
  }
  show()
  {
    this.OBJECT.visible = true;
  }
  remove()
  {
    this.s3d._scene.remove(this.OBJECT);
    this.s3d._models.delete(this.name);
  }

  getPos() {return [this.OBJECT.position.x, this.OBJECT.position.y, this.OBJECT.position.z];}
  pos(p1, p2, p3)
  {
    if (Array.isArray(p1))
      this.OBJECT.position.set(p1[0], p1[1], p1[2]);
    else
      this.OBJECT.position.set(p1, p2, p3);
  }
  move(p1, p2, p3)
  {
    let pos = this.OBJECT.position;
    if (Array.isArray(p1))
    	this.pos(pos.x + p1[0], pos.y + p1[1], pos.z + p1[2]);
    else
    	this.pos(pos.x + p1, pos.y + p2, pos.z + p3);
  }
  move_local(p1, p2, p3)
  {
  	if (Array.isArray(p1))
  	{
	    this.OBJECT.translateX(p1[0]);
	    this.OBJECT.translateY(p1[1]);
	    this.OBJECT.translateZ(p1[2]);
  	}
  	else
  	{
	    this.OBJECT.translateX(p1);
	    this.OBJECT.translateY(p2);
	    this.OBJECT.translateZ(p3);
  	}
  }
  getScale() {return [this.OBJECT.scale.x, this.OBJECT.scale.y, this.OBJECT.scale.z];}
  setScale(p1, p2, p3)
  {
  	if (Array.isArray(p1))
      this.OBJECT.scale.set(p1[0], p1[1], p1[2]);
    else if (p2 !== undefined && p3 !== undefined)
      this.OBJECT.scale.set(p1, p2, p3);
    else
      this.OBJECT.scale.set(p1, p1, p1);
  }
  scale(p1, p2, p3)
  {
    let value = this.OBJECT.scale;
    if (Array.isArray(p1))
    	this.setScale(value.x + p1[0], value.y + p1[1], value.z + p1[2]);
    else if (p2 !== undefined && p3 !== undefined)
      this.setScale(value.x + p1, value.y + p2, value.z + p3);
    else
      this.setScale(value.x + p1, value.y + p1, value.z + p1);
  }
  getRot() {return [site3d.toDeg(this.OBJECT.rotation.x), site3d.toDeg(this.OBJECT.rotation.y), site3d.toDeg(this.OBJECT.rotation.z)];}
  rot(p1, p2, p3)
  {
    if (Array.isArray(p1))
    	this.OBJECT.rotation.set(site3d.toRad(p1[0]), site3d.toRad(p1[1]), site3d.toRad(p1[2]));
    else
    	this.OBJECT.rotation.set(site3d.toRad(p1), site3d.toRad(p2), site3d.toRad(p3));
  }
  rotateLocalRad(stepX, stepY, stepZ)
  {
    this.OBJECT.rotateX(stepX);
    this.OBJECT.rotateY(stepY);
    this.OBJECT.rotateZ(stepZ);
  }
  rotateLocal(stepX, stepY, stepZ) {this.rotateLocalRad(site3d.toRad(stepX), site3d.toRad(stepY), site3d.toRad(stepZ));}
  rotateWorldRad(stepX, stepY, stepZ)
  {
    this.OBJECT.rotateOnWorldAxis(this.s3d._axis.x, stepX);
    this.OBJECT.rotateOnWorldAxis(this.s3d._axis.y, stepY);
    this.OBJECT.rotateOnWorldAxis(this.s3d._axis.y, stepY);
  }
  rotateWorld(stepX, stepY, stepZ){this.rotateWorldRad(site3d.toRad(stepX), site3d.toRad(stepY), site3d.toRad(stepZ));}
  rotate(p1, p2, p3)
  {
  	let stepX = p1;
  	let stepY = p2;
  	let stepZ = p3;
  	if (Array.isArray(p1))
  	{
  		stepX = p1[0];
  		stepY = p1[1];
  		stepZ = p1[2];
  	}
    this.rotateLocal(stepX, stepY, stepZ);
  }
  fill(fill)
  {
    this.s3d._updateMaterial(this.OBJECT.material, fill);
  }
}

class site3dPlane extends site3dModel
{
  constructor(s3d, name, width, height, fill)
  {
    super(s3d, name, {geometry: new PlaneBufferGeometry(width, height, 1, 1), fill: fill});
  }
}

class site3dCircle extends site3dModel
{
  constructor(s3d, name, radius, detail, fill)
  {
    super(s3d, name, {geometry: new CircleGeometry(radius, detail), fill: fill});
  }
}

class site3dCube extends site3dModel
{
  constructor(s3d, name, width, height, depth, fill)
  {
    super(s3d, name, {geometry: new BoxBufferGeometry(width, height, depth), fill: fill});
  }
}

class site3dSphere extends site3dModel
{
  constructor(s3d, name, radius, detail, fill)
  {
    super(s3d, name, {geometry: new SphereBufferGeometry(radius, detail, detail), fill: fill});
  }
}

class site3dHemisphere extends site3dModel
{
  constructor(s3d, name, radius, detail, fill)
  {
    super(s3d, name, {geometry: new SphereBufferGeometry(radius, detail, detail, 0, 2 * Math.PI, 0, Math.PI / 2), fill: fill});
  }
}

class site3dOctahedron extends site3dModel
{
  constructor(s3d, name, radius, detail, fill)
  {
    super(s3d, name, {geometry: new OctahedronBufferGeometry(radius, detail), fill: fill});
  }
}

class site3dText extends site3dModel
{
  constructor(s3d, name, text, options, fill, load)
  {
    super(s3d, name);

    const loader = new FontLoader();
    loader.load(options.font_path, font =>
    {
      const geometry = new TextBufferGeometry(text,
      {
    		font: font,
    		size: options.fontSize,
    		height: 1,
    		curveSegments: 12,
    		bevelEnabled: false,
    		bevelThickness: 10,
    		bevelSize: 8,
    		bevelOffset: 0,
    		bevelSegments: 3
    	});
      if (options.textAlign !== undefined && options.textAlign == 'center')
        geometry.center();
      this.OBJECT = new Mesh(geometry, this.s3d._getFilledMaterial(fill));
      this.s3d._addModel(this);
      load(this);
    });
  }
}

class site3dLight
{
  constructor(s3d, name, object, options)
  {
    this.s3d = s3d;
    this.name = name;
    this.OBJECT = object;
    let color = '#ffffff';
    let power = 1.0;
    let pos = [1, 1, 1];
    let target = [0, 0, 0];
    if (options !== undefined)
    {
      if (options.color !== undefined) color = options.color;
      if (options.power !== undefined) power = options.power;
      if (options.pos !== undefined) pos = options.pos;
      if (options.target !== undefined) target = options.target;
    }
    this.setColor(color);
    this.setPower(power);
    if (this.OBJECT.position !== undefined)
      this.pos(pos);
    if (this.OBJECT.target !== undefined)
      this.target(target);
    this.s3d._addLight(this);
  }

  setColor(color) {this.OBJECT.color.set(color);}
  setPower(power) {this.OBJECT.intensity = power;}

  getPos() {return [this.OBJECT.position.x, this.OBJECT.position.y, this.OBJECT.position.z];}
  pos(p1, p2, p3)
  {
    if (Array.isArray(p1))
      this.OBJECT.position.set(p1[0], p1[1], p1[2]);
    else
      this.OBJECT.position.set(p1, p2, p3);
  }
  move(stepX, stepY, stepZ)
  {
    let pos = this.OBJECT.position;
    this.pos(pos.x + stepX, pos.y + stepY, pos.z + stepZ);
  }

  getTarget() {return [this.OBJECT.target.position.x, this.OBJECT.target.position.y, this.OBJECT.target.position.z];}
  target(p1, p2, p3)
  {
    if (Array.isArray(p1))
      this.OBJECT.target.position.set(p1[0], p1[1], p1[2]);
    else
      this.OBJECT.target.position.set(p1, p2, p3);
  }
  move_target(stepX, stepY, stepZ)
  {
    let pos = this.OBJECT.target.position;
    this.target(pos.x + stepX, pos.y + stepY, pos.z + stepZ);
  }
}

class site3dAmbientLight extends site3dLight
{
  constructor(s3d, name, options)
  {
    super(s3d, name, new AmbientLight(), options);
  }
}

class site3dDirectionalLight extends site3dLight
{
  constructor(s3d, name, options)
  {
    super(s3d, name, new DirectionalLight(), options);
  }
}

class site3dSpotLight extends site3dLight
{
  constructor(s3d, name, options)
  {
    super(s3d, name, new SpotLight(), options);
    let angle = Math.PI / 4;
    let blur = 0.5;
    if (options !== undefined)
    {
      if (options.angle !== undefined) angle = site3d.toRad(options.angle);
      if (options.blur !== undefined) blur = options.blur;
    }
    this.OBJECT.angle = angle;
    this.OBJECT.penumbra = blur;
  }
}