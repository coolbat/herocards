/* Shared card preview lighting. Shader matches the established app.js material values.
 * Event-driven rendering: one context, four reusable textures, no idle animation loop.
 * Keep a 2D diffuse canvas underneath for unavailable/lost WebGL contexts.
 */
(function (global) {
  'use strict';
  var VERT = `#version 300 es
  in vec2 aPos;
  out vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

  var FRAG = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 frag;

  uniform sampler2D uDiffuse;
  uniform sampler2D uNormal;
  uniform sampler2D uRough;
  uniform sampler2D uHeight;

  uniform vec2  uMouse;       // 指针在 canvas UV 中的位置（y 向上）
  uniform float uHasMouse;
  uniform float uParallax;
  uniform float uLightZ;
  uniform float uNormalStr;
  uniform float uSpecStr;
  uniform float uDiffuseAmt;
  uniform float uAmbientAmt;
  uniform vec3  uLightColor;
  uniform vec3  uAmbientColor;
  uniform float uMotion;

  void main() {
    vec2 uv = vUv;

    // 高度视差：凸起像素随指针反向漂移
    float h0 = texture(uHeight, uv).r;
    if (uMotion > 0.5 && uHasMouse > 0.5) {
      vec2 viewOff = (uMouse - vec2(0.5)) * 2.0;
      uv = clamp(uv - viewOff * (h0 * uParallax), 0.001, 0.999);
    }

    vec4 diff = texture(uDiffuse, uv);
    float a = diff.a;
    if (a < 0.004) { frag = vec4(0.0); return; }

    vec3 albedo = diff.rgb;
    float rough = texture(uRough, uv).r;
    float h = texture(uHeight, uv).r;

    vec3 nRaw = texture(uNormal, uv).xyz * 2.0 - 1.0;
    nRaw.xy *= uNormalStr;
    vec3 N = normalize(vec3(nRaw.xy, max(nRaw.z, 0.08)));

    vec3 V = vec3(0.0, 0.0, 1.0);
    float ambRelief = 0.74 + 0.26 * max(N.z, 0.0);
    vec3 col = albedo * uAmbientColor * uAmbientAmt * ambRelief;

    // 跟随指针的奥术暖金主光源
    vec2 lightUv = (uHasMouse > 0.5) ? uMouse : vec2(0.44, 0.66);
    vec3 L = normalize(vec3(lightUv.x - uv.x, lightUv.y - uv.y, uLightZ));
    float ndl = max(dot(N, L), 0.0);
    float wrap = ndl * 0.8 + 0.2;
    col += albedo * uLightColor * (wrap * uDiffuseAmt);

    // 粗糙度塑形的高光：烧金线稿吃光，哑光墨色保持安静
    vec3 H = normalize(L + V);
    float shininess = mix(52.0, 6.0, clamp(rough, 0.0, 1.0));
    float spec = pow(max(dot(N, H), 0.0), shininess);
    spec *= (1.0 - rough * 0.85) * uSpecStr;
    spec *= 0.82 + 0.34 * h;
    col += uLightColor * spec;

    // 主光从侧面掠射时的微弱暖色轮廓光
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.4);
    float side = 1.0 - abs(L.z);
    col += uLightColor * rim * side * 0.1 * (1.0 - rough * 0.5);

    col = clamp(col, 0.0, 1.0);
    frag = vec4(col * a, a);
  }`;


  function create(canvas) {
    var gl;
    try { gl = canvas.getContext('webgl2', { alpha: true, antialias: false,
      premultipliedAlpha: true, preserveDrawingBuffer: true }); } catch (e) { return null; }
    if (!gl) return null;
    var program, buffer, vao, textures = [], uniforms = {}, lastSet = null;
    var disposed = false, pointer = null;
    var reducedMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)');
    canvas.hidden = true;

    function compile(type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    }
    function init() {
      var vs, fs;
      try {
        vs = compile(gl.VERTEX_SHADER, VERT);
        fs = compile(gl.FRAGMENT_SHADER, FRAG);
        program = gl.createProgram();
        gl.attachShader(program, vs); gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      } finally {
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
      }
      gl.useProgram(program);
      vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
      var pos = gl.getAttribLocation(program, 'aPos');
      gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
      ['uDiffuse','uNormal','uRough','uHeight','uMouse','uHasMouse','uParallax',
        'uLightZ','uNormalStr','uSpecStr','uDiffuseAmt','uAmbientAmt','uLightColor',
        'uAmbientColor','uMotion'].forEach(function (name) { uniforms[name] = gl.getUniformLocation(program, name); });
      ['uDiffuse','uNormal','uRough','uHeight'].forEach(function (name, i) {
        gl.uniform1i(uniforms[name], i);
        var tex = gl.createTexture(); textures.push(tex);
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // The finished diffuse contains small lettering and engraved lines. Blending
        // its automatically reduced mip levels visibly softens these at card size.
        // Sample the original diffuse; supersampling below handles final reduction.
        // Material maps still use mipmaps to keep moving highlights stable.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
          i === 0 ? gl.LINEAR : gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      });
      gl.uniform3f(uniforms.uLightColor, 1, 0.90, 0.72);
      gl.uniform3f(uniforms.uAmbientColor, 0.70, 0.79, 0.94);
      gl.uniform1f(uniforms.uAmbientAmt, 0.56);
      gl.uniform1f(uniforms.uDiffuseAmt, 0.62);
      gl.uniform1f(uniforms.uSpecStr, 0.34);
      gl.uniform1f(uniforms.uNormalStr, 1.35);
      gl.uniform1f(uniforms.uLightZ, 0.5);
      gl.uniform1f(uniforms.uParallax, 0.0034);
    }
    function draw(mouse) {
      pointer = mouse || null;
      if (disposed || !lastSet || gl.isContextLost()) return;
      // Keep at least 2x samples even on 1x displays. Use layout size so pointer
      // tilt does not resize/reallocate the drawing buffer every time it moves.
      var dpr = Math.min(Math.max(global.devicePixelRatio || 1, 2), 2.5);
      var width = Math.min(lastSet.diffuse.width, Math.max(1, Math.round(canvas.clientWidth * dpr)));
      var height = Math.min(lastSet.diffuse.height, Math.max(1, Math.round(canvas.clientHeight * dpr)));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height);
      gl.useProgram(program); gl.bindVertexArray(vao);
      var active = pointer && !(reducedMotion && reducedMotion.matches);
      gl.uniform1f(uniforms.uMotion, active ? 1 : 0);
      gl.uniform1f(uniforms.uHasMouse, active ? 1 : 0);
      gl.uniform2f(uniforms.uMouse, active ? pointer[0] : 0.44, active ? pointer[1] : 0.66);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function setMaps(set) {
      lastSet = set;
      if (disposed || gl.isContextLost()) return;
      gl.useProgram(program);
      ['diffuse','normal','rough','height'].forEach(function (name, i) {
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, textures[i]);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, set[name]);
        if (i !== 0) gl.generateMipmap(gl.TEXTURE_2D);
      });
      canvas.hidden = false;
      draw(null);
    }
    function release() {
      textures.forEach(function (tex) { gl.deleteTexture(tex); }); textures = [];
      if (buffer) gl.deleteBuffer(buffer);
      if (vao) gl.deleteVertexArray(vao);
      if (program) gl.deleteProgram(program);
    }
    function lost(ev) { ev.preventDefault(); canvas.hidden = true; }
    function restored() {
      if (disposed) return;
      textures = [];
      try { init(); if (lastSet) setMaps(lastSet); }
      catch (e) { canvas.hidden = true; }
    }
    try { init(); } catch (e) { release(); return null; }
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return {
      setMaps: setMaps,
      draw: draw,
      resize: function () { draw(pointer); },
      dispose: function () {
        if (disposed) return;
        disposed = true; lastSet = null; release(); canvas.hidden = true;
        canvas.removeEventListener('webglcontextlost', lost);
        canvas.removeEventListener('webglcontextrestored', restored);
      }
    };
  }
  global.CardLighting = { create: create };
})(window);
