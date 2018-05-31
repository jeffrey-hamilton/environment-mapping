var gl = null; //our OpenGL handler

var GC = {};   //the graphics context

//initialize the graphics context variables
GC.shaderProgram = null;          //our GLSL program
GC.vertexPositionAttribute = null;//location of vertex positions in GLSL program
GC.barycentricBuffer = null;      //array passed to shader to create wireframe display
GC.barycentricAttribute = null;   //location of barycentric coordinate array in GLSL program
GC.perspectiveMatrix = null;      //the Perspective matrix
GC.mvMatrix = null;               //the ModelView matrix
GC.mvMatrixStack = [];            //the ModelView matrix stack
GC.mesh = null;                   //the current mesh
GC.mouseDown = null;              //boolean check for mouseDown
GC.width = 1000;                   //render area width
GC.height = 750;                  //render area height
GC.texture = null;

// Material information
GC.materialAmb = [0.24725, 0.08825, 0.0225];
GC.materialDiff = [0.75164, 0.60648, 0.22648];
GC.materialSpec = [0.628281, 0.555802, 0.366065];
//GC.materialAmb = [0.25, 0.1, 0.1];
//GC.materialDiff = [0.5, 0.4, 0.1];
GC.materialShine = 51.2;

// Specify the light source (at the camera, white)
GC.lightAmb = [1.0, 1.0, 1.0];
GC.lightDiff = [1.0, 1.0, 1.0];
GC.lightSpec = [1.0, 1.0, 1.0];

var camera = new ArcBall();              //create a new arcball camera
camera.setBounds(GC.width,GC.height);    //initialize camera with screen space dimensions
var numLoaded = 0;

//demo constructor
function demo(canvasName,Mesh) {
	this.canvasName = canvasName;
	GC.mesh = Mesh;
}

//initialize webgl, populate all buffers, load shader programs, and start drawing
demo.prototype.init = function(){
	this.canvas = document.getElementById(this.canvasName);
	this.canvas.width = GC.width;
	this.canvas.height = GC.height;

	//Here we check to see if WebGL is supported
	this.initWebGL(this.canvas);

	gl.clearColor(0.0,0.0,0.0,1.0);     //background to black
	gl.clearDepth(1.0);                 //set depth to yon plane
	gl.enable(gl.DEPTH_TEST);           //enable depth test
	gl.depthFunc(gl.LEQUAL);            //change depth test to use LEQUAL

	//set mouse event callbacks
	this.setMouseEventCallbacks();

	//set keyboard event callbacks
	this.setKeyboardEventCallbacks();

	//Get opengl derivative extension -- enables using fwidth in shader
	gl.getExtension("OES_standard_derivatives");

	// Calculate the per vertex normals
	this.calcPerVertexNormals(GC.mesh);

	//init the shader programs
	this.initShaders();

	//init the vertex buffer
	this.initGeometryBuffers();

	// Load the texture for
//	this.texture = loadTexture("UT.png");
//	this.texture = loadTexture("Power-T-transparent.png");
	this.texture = loadCubeMap();
}

demo.prototype.MainLoop = function(){
	drawScene();
}

demo.prototype.setMouseEventCallbacks = function(){
	//-------- set callback functions
	this.canvas.onmousedown = this.mouseDown;
	this.canvas.onmousewheel = this.mouseWheel;

	//--Why set these to callbacks for the document object?
	document.onmouseup = this.mouseUp;
	document.onmousemove = this.mouseMove;

	//--touch event callbacks
	this.canvas.ontouchstart = this.touchDown;
	this.canvas.ontouchend = this.touchUp;
	this.canvas.ontouchmove = this.touchMove;
	//-------- end set callback functions
}

demo.prototype.setKeyboardEventCallbacks = function(){
	//--Why set these to callbacks for the document object?
	document.onkeydown = this.keyDown;
}

demo.prototype.calcPerVertexNormals = function(mesh){
	var m = mesh.model;

	// Initialize an array for the per vertex normals
	m.normals = [];
	for(var i = 0; i < m.vertices.length; i++){
		m.normals.push(0);
	}

	// For each face...
	for(var i = 0; i < m.indices.length; i += 3){

		// Get the vertices
		var vert1 = m.indices[i];
		var vert2 = m.indices[i + 1];
		var vert3 = m.indices[i + 2];

		// Get the vertices' x,y,z
		var v1x = m.vertices[(vert1 * 3)];
		var v1y = m.vertices[(vert1 * 3) + 1];
		var v1z = m.vertices[(vert1 * 3) + 2];

		var v2x = m.vertices[(vert2 * 3)];
		var v2y = m.vertices[(vert2 * 3) + 1];
		var v2z = m.vertices[(vert2 * 3) + 2];

		var v3x = m.vertices[(vert3 * 3)];
		var v3y = m.vertices[(vert3 * 3) + 1];
		var v3z = m.vertices[(vert3 * 3) + 2];

		// Get the two coplanar vectors that define the face
		var v1 = [v2x - v1x, v2y - v1y, v2z - v1z];
		var v2 = [v3x - v1x, v3y - v1y, v3z - v1z];

		// Get the normal, the cross product of the two coplanar vectors
		var normal = cross(v1, v2);

		// Get the normal vector's length
		var normalLength = Vector3fLength(normal);

		// Normalize the normal vector
		normal[0] /= normalLength;
		normal[1] /= normalLength;
		normal[2] /= normalLength;

		// Add the unit normal vector's x,y,z components to each of the faces' vertices'
		// normals total
		m.normals[(vert1 * 3)] += normal[0];
		m.normals[(vert1 * 3) + 1] += normal[1];
		m.normals[(vert1 * 3) + 2] += normal[2];

		m.normals[(vert2 * 3)] += normal[0];
		m.normals[(vert2 * 3) + 1] += normal[1];
		m.normals[(vert2 * 3) + 2] += normal[2];

		m.normals[(vert3 * 3)] += normal[0];
		m.normals[(vert3 * 3) + 1] += normal[1];
		m.normals[(vert3 * 3) + 2] += normal[2];
	}

	// Normalize the calculated per vertex normals
	for(var i = 0; i < m.normals.length; i += 3){
		var v = [m.normals[i], m.normals[i+1], m.normals[i+2]];

		m.normals[i] /= Vector3fLength(v);
		m.normals[i + 1] /= Vector3fLength(v);
		m.normals[i + 2] /= Vector3fLength(v);
	}
}


//initialize the shaders and grab the shader variable attributes
demo.prototype.initShaders = function(){
	var fragmentShader = this.getShader("Step4FragmentShader");
	var vertexShader = this.getShader("Step4VertexShader");

	this.shaderProgram = gl.createProgram();
	gl.attachShader(this.shaderProgram, vertexShader);
	gl.attachShader(this.shaderProgram, fragmentShader);
	gl.linkProgram(this.shaderProgram);

	if(!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)){
		console.log("unable to init shader program");
	}

	gl.useProgram(this.shaderProgram);

	GC.vertexPositionAttribute = gl.getAttribLocation(this.shaderProgram, "vPos");
	gl.enableVertexAttribArray(GC.vertexPositionAttribute);

	GC.normalAttribute = gl.getAttribLocation(this.shaderProgram, "norm");
	gl.enableVertexAttribArray(GC.normalAttribute);

	GC.texCoordAttribute = gl.getAttribLocation(this.shaderProgram, "texCoord");
	gl.enableVertexAttribArray(GC.texCoordAttribute);

	GC.shaderProgram = this.shaderProgram;
}

//initialize the buffers for drawing and the edge highlights
demo.prototype.initGeometryBuffers = function(){
	var m = GC.mesh.model;

	//create an OpenGL buffer
	GC.barycentricBuffer = gl.createBuffer();

	var verts = [];						// Array to hold vertices laid out according to indices
	var bary = [];						// Array of 1s and 0s passed to GLSL to draw wireframe
	var norms = [];						// Array to hold per-vertex normals
	var texCoords = [];					// Array to hold per-vertex texture coordinates
	var min = [90000,90000,90000];		// Used for bounding box calculations
	var max = [-90000,-90000,-90000];	// Used for bounding box calculations

	// Loop through the indices array and create a vertices array from the listed indices
	m.indices.forEach(function(d,i){
			// Grab the x,y,z values for the current vertex
			vx = (parseFloat(m.vertices[d*3]));
			vy = (parseFloat(m.vertices[d*3+1]));
			vz = (parseFloat(m.vertices[d*3+2]));

			// Add this vertex to our array
			verts.push(vx,vy,vz);

			// Grab the x,y,z normal vector for the current vertex
			var nx = m.normals[(d * 3)];
			var ny = m.normals[(d * 3) + 1];
			var nz = m.normals[(d * 3) + 2];

			// Add this vector to the array of normals
			norms.push(nx, ny, nz);

			var texIndex = m.texIndices[i];
			var tx = m.texCoords[(texIndex * 2)];
			var ty = m.texCoords[(texIndex * 2) + 1];

			// Add this vector to the array of texture coordinates
			texCoords.push(tx, ty);

			// Check to see if we need to update the min/max
			if(vx < min[0]) min[0] = vx;
			if(vy < min[1]) min[1] = vy;
			if(vz < min[2]) min[2] = vz;
			if(vx > max[0]) max[0] = vx;
			if(vy > max[1]) max[1] = vy;
			if(vz > max[2]) max[2] = vz;

			// What does this do?
			if(i%3 == 0){
				bary.push(1,0,0);
			} else if(i % 3 == 1){
				bary.push(0,1,0);
			} else if(i % 3 == 2){
				bary.push(0,0,1);
			}
	});

	// Set the min/max variables
	m.minX = min[0]; m.minY = min[1]; m.minZ = min[2];
	m.maxX = max[0]; m.maxY = max[1]; m.maxZ = max[2];

	// Calculate the largest range in x,y,z
	var s = Math.max( Math.abs(min[0]-max[0]),
			Math.abs(min[1]-max[1]),
			Math.abs(min[2]-max[2]))

	// Calculate the distance to place camera from model
	var d = (s/2.0)/Math.tan(45/2.0);

	// Place the camera at the calculated position
	camera.position[2] = d;

	// Orient the camera to look at the center of the model
	camera.lookAt = [(m.minX+m.maxX)/2.0,(m.minY+m.maxY)/2.0,(m.minZ+m.maxZ)/2.0];

	// Bind the data we placed in the bary array to an OpenGL buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, GC.barycentricBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bary), gl.STATIC_DRAW);

	// Bind the data we placed in the verts array to an OpenGL buffer
	m.vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, m.vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

	// Bind the data we placed in the normal array to an OpenGL buffer
	m.normalBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, m.normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(norms), gl.STATIC_DRAW);

	// Bind the texture coordinate data to an OpenGL buffer
	GC.texCoordBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, GC.texCoordBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
}

//the drawing function
function drawScene(){
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	var m = GC.mesh.model;

	//setup perspective and lookat matrices
	GC.perspectiveMatrix = makePerspective(45, GC.width/GC.height, 0.1, Math.max(2000.0,m.maxZ));
	var lookAtMatrix = makeLookAt(camera.position[0],camera.position[1],camera.position[2],
			camera.lookAt[0],camera.lookAt[1],camera.lookAt[2],
			0,1,0);

	//set initial camera lookat matrix
	mvLoadIdentity(GC);

	//multiply by our lookAt matrix
	mvMultMatrix(lookAtMatrix,GC);

	//--------- camera rotation matrix multiplicaton
	//translate to origin of model for rotation
	mvTranslate([(m.minX+m.maxX)/2.0,(m.minY+m.maxY)/2.0,(m.minZ+m.maxZ)/2.0],GC);

	mvMultMatrix(camera.Transform,GC);//multiply by the transformation

	//translate back to original origin
	mvTranslate([-(m.minX+m.maxX)/2.0,-(m.minY+m.maxY)/2.0,-(m.minZ+m.maxZ)/2.0],GC);
	//---------

	//passes modelview and projection matrices to the vertex shader
	setMatrixUniforms(GC);

	// Pass the light position to the vertex shader
	var lightUniform = gl.getUniformLocation(GC.shaderProgram, "lightPos");
	gl.uniform3f(lightUniform, camera.position[0], camera.position[1], camera.position[2]);
	console.log(camera.position);

	// Pass the min and max heights to the vertex shader
	var minHeightUniform = gl.getUniformLocation(GC.shaderProgram, "minHeight");
	gl.uniform1f(minHeightUniform, GC.mesh.model.minY);
	var maxHeightUniform = gl.getUniformLocation(GC.shaderProgram, "maxHeight");
	gl.uniform1f(maxHeightUniform, GC.mesh.model.maxY);

	// Pass the material to the vertex and fragment shaders
	var mauniform = gl.getUniformLocation(GC.shaderProgram, "materialAmb");
	gl.uniform3f(mauniform, GC.materialAmb[0], GC.materialAmb[1], GC.materialAmb[2]);
	var mduniform = gl.getUniformLocation(GC.shaderProgram, "materialDiff");
	gl.uniform3f(mduniform, GC.materialDiff[0], GC.materialDiff[1], GC.materialDiff[2]);
	var msuniform = gl.getUniformLocation(GC.shaderProgram, "materialSpec");
	gl.uniform3f(msuniform, GC.materialSpec[0], GC.materialSpec[1], GC.materialSpec[2]);
	var mshuniform = gl.getUniformLocation(GC.shaderProgram, "materialShine");
	gl.uniform1f(mshuniform, GC.materialShine);

	// Pass the light properties to the vertex and fragment shaders
	var launiform = gl.getUniformLocation(GC.shaderProgram, "lightAmb");
	gl.uniform3f(launiform, GC.lightAmb[0], GC.lightAmb[1], GC.lightAmb[2]);
	var lduniform = gl.getUniformLocation(GC.shaderProgram, "lightDiff");
	gl.uniform3f(lduniform, GC.lightDiff[0], GC.lightDiff[1], GC.lightDiff[2]);
	var lsuniform = gl.getUniformLocation(GC.shaderProgram, "lightSpec");
	gl.uniform3f(lsuniform, GC.lightSpec[0], GC.lightSpec[1], GC.lightSpec[2]);

	// Sampler

	//pass the vertex buffer to the shader
	gl.bindBuffer(gl.ARRAY_BUFFER, m.vertexBuffer);
	gl.vertexAttribPointer(GC.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

	// Pass the normals to the shader
	gl.bindBuffer(gl.ARRAY_BUFFER, m.normalBuffer);
	gl.vertexAttribPointer(GC.normalAttribute, 3, gl.FLOAT, false, 0, 0);

	// Pass the texture coordinates to the shader
	gl.bindBuffer(gl.ARRAY_BUFFER, GC.texCoordBuffer);
	gl.vertexAttribPointer(GC.texCoordAttribute, 2, gl.FLOAT, false, 0, 0);

	console.log(camera);

	// Draw everything
	gl.drawArrays(gl.TRIANGLES,0,m.indices.length);
}

//initialize webgl
demo.prototype.initWebGL = function(){
	gl = null;

	try {
		gl = this.canvas.getContext("experimental-webgl");
	}
	catch(e) {
		//pass through
	}

	// If we don't have a GL context, give up now
	if (!gl) {
		alert("Unable to initialize WebGL. Your browser may not support it.");
	}
}

//compile shader located within a script tag
demo.prototype.getShader = function(id){
	var shaderScript, theSource, currentChild, shader;

	shaderScript = document.getElementById(id);
	if(!shaderScript){
		return null;
	}

	//init the source code variable
	theSource = "";

	//begin reading the shader source from the beginning
	currentChild = shaderScript.firstChild;

	//read the shader source as text
	while(currentChild){
		if(currentChild.nodeType == currentChild.TEXT_NODE){
			theSource += currentChild.textContent;
		}
		currentChild = currentChild.nextSibling;
	}

	//check type of shader to give openGL the correct hint
	if(shaderScript.type == "x-shader/x-fragment"){
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else if(shaderScript.type == "x-shader/x-vertex"){
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else {
		return null;
	}

	//add the shader source code to the created shader object
	gl.shaderSource(shader, theSource);

	//compile the shader
	gl.compileShader(shader);

	if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
		console.log("error compiling shaders -- " + gl.getShaderInfoLog(shader));
		return null;
	}

	return shader;
}


//handle mousedown
demo.prototype.mouseDown = function(event){
	GC.mouseDown = true;

	//update the base rotation so model doesn't jerk around upon new clicks
	camera.LastRot = camera.ThisRot;
	camera.click(event.clientX,event.clientY);

	return false;
}

//handle mouseup
demo.prototype.mouseUp = function(event){
	GC.mouseDown = false;
	return false;
}

//handle mouse movement
demo.prototype.mouseMove = function(event){
	if(GC.mouseDown == true){
		X = event.clientX;
		Y = event.clientY;

		//call camera function for handling mouse movement
		camera.move(X,Y)

			drawScene();
	}
	return false;
}

//handle mouse scroll event
demo.prototype.mouseWheel = function(event){
	camera.zoomScale -= event.wheelDeltaY*0.0005;
	camera.Transform.elements[3][3] = camera.zoomScale;

	drawScene();
	return false;
}


//--------- handle keyboard events
demo.prototype.keyDown = function(e){
	camera.LastRot = camera.ThisRot;
	var center = {x: GC.width/2, y:GC.height/2};
	var delta = 8;

	switch(e.keyCode){
		case 37: //Left arrow
			camera.click(center.x, center.y);
			camera.move(center.x - delta, center.y);
			break;
		case 38: //Up arrow
			camera.click(center.x, center.y);
			camera.move(center.x, center.y - delta);
			break;
		case 39: //Right arrow
			camera.click(center.x, center.y);
			camera.move(center.x + delta, center.y);
			break;
		case 40: //Down arrow
			camera.click(center.x, center.y);
			camera.move(center.x, center.y + delta);
			break;
	}

	//redraw
	drawScene();
}


// --------- handle touch events
demo.prototype.touchDown = function(event){
	GC.mouseDown = true;

	//update the base rotation so model doesn't jerk around upon new clicks
	camera.LastRot = camera.ThisRot;

	//tell the camera where the touch event happened
	camera.click(event.changedTouches[0].pageX,event.changedTouches[0].pageY);

	return false;
}

//handle touchEnd
demo.prototype.touchUp = function(event){
	GC.mouseDown = false;
	return false;
}

//handle touch movement
demo.prototype.touchMove = function(event){
	if(GC.mouseDown == true){
		X = event.changedTouches[0].pageX;
		Y = event.changedTouches[0].pageY;

		//call camera function for handling mouse movement
		camera.move(X,Y)

			drawScene();
	}
	return false;
}
// --------- end handle touch events

function loadTexture(src){
	var texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
//	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
//	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	var image = new Image();

	image.onload = function(){
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	};

	image.src = src;
	return texture;
}

images = ""
function loadCubeMap(){
	var texture = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
//	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
//	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

/*	images = [["plate1.bmp", gl.TEXTURE_CUBE_MAP_POSITIVE_Y],
			["plate2.bmp", gl.TEXTURE_CUBE_MAP_NEGATIVE_X],
			["plate3.bmp", gl.TEXTURE_CUBE_MAP_POSITIVE_Z],
			["plate4.bmp", gl.TEXTURE_CUBE_MAP_POSITIVE_X],
			["plate5.bmp", gl.TEXTURE_CUBE_MAP_NEGATIVE_Z],
			["plate6.bmp", gl.TEXTURE_CUBE_MAP_NEGATIVE_Y]]; */

	images = [["cubemaps/yokohama/posx.jpg", gl.TEXTURE_CUBE_MAP_POSITIVE_X],
			["cubemaps/yokohama/negx.jpg", gl.TEXTURE_CUBE_MAP_NEGATIVE_X],
			["cubemaps/yokohama/posy.jpg", gl.TEXTURE_CUBE_MAP_POSITIVE_Y],
			["cubemaps/yokohama/negy.jpg", gl.TEXTURE_CUBE_MAP_NEGATIVE_Y],
			["cubemaps/yokohama/posz.jpg", gl.TEXTURE_CUBE_MAP_POSITIVE_Z],
			["cubemaps/yokohama/negz.jpg", gl.TEXTURE_CUBE_MAP_NEGATIVE_Z]];

	for(var i = 0; i < images.length; i++){
		var face = images[i][1];
		var image = new Image();
		image.onload = function(texture, face, image){
			return function(){
				gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
				console.log(image.src);
				gl.texImage2D(face, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

				numLoaded++;
				callbackfunc(texture);
			}
		}(texture, face, image);

		image.src = images[i][0];
	}

	return texture;
}

function callbackfunc(texture){
	if(numLoaded == 6){
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
		var suniform = gl.getUniformLocation(GC.shaderProgram, "sampler");
		gl.uniform1i(suniform, 0);
	}
}
