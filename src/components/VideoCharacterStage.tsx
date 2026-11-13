import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppuAnimationState, AppuEmotion, CharacterControlState } from '../types/character';
import {
  getDefaultVideoManifest,
  loadVideoCharacterManifest,
  resolveVideoAnimation,
  VideoCharacterManifest,
} from '../services/videoCharacterManifest';
import './VideoCharacterStage.css';

interface VideoCharacterStageProps {
  characterId: string;
  controls: CharacterControlState;
  onControlsChange: React.Dispatch<React.SetStateAction<CharacterControlState>>;
  onAnimationEnded?: () => void;
}

const DRAG_START_THRESHOLD_PX = 4;

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

// Green-excess chroma key + spill suppression shader optimized for white fur & blue outfits
const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  uniform sampler2D u_texture;
  uniform vec4 u_crop; // x, y, width, height
  uniform float u_similarity;
  uniform float u_smoothness;
  uniform float u_spill;
  varying vec2 v_texCoord;

  void main() {
    vec2 uv = vec2(
      u_crop.x + v_texCoord.x * u_crop.z,
      u_crop.y + v_texCoord.y * u_crop.w
    );

    vec4 tex = texture2D(u_texture, uv);
    float maxRB = max(tex.r, tex.b);
    float gExcess = tex.g - maxRB;
    float gDominance = gExcess / max(tex.g, 0.001);

    // Key out bright chroma green as well as shaded green floor shadows & curly hair fringes
    float low = max(0.008, u_similarity - u_smoothness);
    float high = u_similarity + u_smoothness;
    float keyAbs = smoothstep(low, high, gExcess);
    float keyShadow = smoothstep(0.22, 0.52, gDominance) * step(0.025, tex.g);
    float alpha = 1.0 - max(keyAbs, keyShadow);

    // Full-spectrum despill along hair curls, clothing edges, and white sneakers (zero green tint)
    float spillFactor = clamp(u_spill * smoothstep(0.002, 0.035, gExcess), 0.0, 1.0);
    vec3 despilled = tex.rgb;
    despilled.g = mix(tex.g, min(tex.g, maxRB * 0.96), spillFactor);

    // Soft border feathering inside crop to guarantee zero boundary line artifacts
    float edgeX = smoothstep(0.0, 0.015, v_texCoord.x) * smoothstep(1.0, 0.985, v_texCoord.x);
    float edgeY = smoothstep(0.0, 0.01, v_texCoord.y) * smoothstep(1.0, 0.99, v_texCoord.y);
    alpha *= edgeX * edgeY;

    // Premultiplied output for clean transparent canvas compositing
    gl_FragColor = vec4(despilled * alpha, alpha);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export const VideoCharacterStage: React.FC<VideoCharacterStageProps> = ({
  characterId,
  controls,
  onControlsChange,
  onAnimationEnded,
}) => {
  const [manifest, setManifest] = useState<VideoCharacterManifest>(() =>
    getDefaultVideoManifest(characterId)
  );
  const [videoReady, setVideoReady] = useState(false);
  const [useDirectAlpha, setUseDirectAlpha] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glStateRef = useRef<{
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    texture: WebGLTexture;
    cropLoc: WebGLUniformLocation | null;
    simLoc: WebGLUniformLocation | null;
    smoothLoc: WebGLUniformLocation | null;
    spillLoc: WebGLUniformLocation | null;
  } | null>(null);

  // Drag tracking for desktop companion window movement
  const isGrabbingRef = useRef(false);
  const dragStartedRef = useRef(false);
  const pointerLastScreenRef = useRef({ x: 0, y: 0 });
  const pointerHistoryRef = useRef<{ x: number; y: number; time: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    setManifest(getDefaultVideoManifest(characterId));
    loadVideoCharacterManifest(characterId).then((loaded) => {
      if (!cancelled) setManifest(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  const effectiveAnimationState: AppuAnimationState = controls.isGrabbed
    ? 'being_dragged'
    : (controls.animationState as AppuAnimationState);

  const resolved = useMemo(
    () =>
      resolveVideoAnimation(
        manifest,
        effectiveAnimationState,
        controls.emotion as AppuEmotion
      ),
    [manifest, effectiveAnimationState, controls.emotion]
  );

  const activeEntry = resolved.entry;
  const shouldApplyChromaKey = Boolean(manifest.chromaKey?.enabled && !activeEntry.alpha);

  useEffect(() => {
    setUseDirectAlpha(!shouldApplyChromaKey);
  }, [shouldApplyChromaKey]);

  // Ensure video plays smoothly whenever source or play state changes
  const endedTriggeredRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    endedTriggeredRef.current = false;
    video.loop = activeEntry.loop;
    video.playbackRate = Math.max(0.25, Math.min(2.5, controls.animationSpeed || 1.0));
    if (typeof activeEntry.startTime === 'number' && video.readyState >= 1) {
      video.currentTime = activeEntry.startTime;
    }

    if (controls.isPlaying) {
      const playPromise = video.play?.();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } else {
      video.pause?.();
    }
  }, [activeEntry.file, activeEntry.loop, activeEntry.startTime, controls.isPlaying, controls.animationSpeed]);

  // Initialize WebGL chroma-key pipeline and animation loop
  useEffect(() => {
    if (useDirectAlpha || webglFailed) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      gl = null;
    }

    if (!gl) {
      setWebglFailed(true);
      return;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vs || !fs) {
      setWebglFailed(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setWebglFailed(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setWebglFailed(true);
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]),
      gl.STATIC_DRAW
    );
    const texLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    if (!texture) {
      setWebglFailed(true);
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    glStateRef.current = {
      gl,
      program,
      texture,
      cropLoc: gl.getUniformLocation(program, 'u_crop'),
      simLoc: gl.getUniformLocation(program, 'u_similarity'),
      smoothLoc: gl.getUniformLocation(program, 'u_smoothness'),
      spillLoc: gl.getUniformLocation(program, 'u_spill'),
    };

    let rafId = 0;

    const renderFrame = () => {
      const state = glStateRef.current;
      if (state && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        const crop = manifest.crop || { x: 0, y: 0, width: 1, height: 1 };
        const targetW = Math.max(2, Math.round(video.videoWidth * crop.width));
        const targetH = Math.max(2, Math.round(video.videoHeight * crop.height));

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const { gl: ctx } = state;
        ctx.viewport(0, 0, canvas.width, canvas.height);
        ctx.clearColor(0, 0, 0, 0);
        ctx.clear(ctx.COLOR_BUFFER_BIT);

        ctx.bindTexture(ctx.TEXTURE_2D, state.texture);
        ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, video);

        const ck = manifest.chromaKey;
        ctx.uniform4f(state.cropLoc, crop.x, crop.y, crop.width, crop.height);
        ctx.uniform1f(state.simLoc, ck?.similarity ?? 0.36);
        ctx.uniform1f(state.smoothLoc, ck?.smoothness ?? 0.14);
        ctx.uniform1f(state.spillLoc, ck?.spillSuppression ?? 0.88);

        ctx.drawArrays(ctx.TRIANGLES, 0, 6);
        if (!videoReady) setVideoReady(true);
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      glStateRef.current = null;
      if (gl) {
        gl.deleteTexture(texture);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
      }
    };
  }, [manifest, useDirectAlpha, webglFailed, videoReady]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isGrabbingRef.current = true;
    dragStartedRef.current = false;
    pointerLastScreenRef.current = { x: e.screenX, y: e.screenY };
    pointerHistoryRef.current = [{ x: e.screenX, y: e.screenY, time: performance.now() }];
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported in test environment
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isGrabbingRef.current) return;

    if (!dragStartedRef.current) {
      const moved = Math.hypot(
        e.screenX - pointerLastScreenRef.current.x,
        e.screenY - pointerLastScreenRef.current.y
      );
      if (moved < DRAG_START_THRESHOLD_PX) return;
      dragStartedRef.current = true;
      onControlsChange((prev) => ({ ...prev, isGrabbed: true }));
      window.dispatchEvent(new CustomEvent('appu-drag-start'));
    }

    const screenDx = Math.round(e.screenX - pointerLastScreenRef.current.x);
    const screenDy = Math.round(e.screenY - pointerLastScreenRef.current.y);

    pointerHistoryRef.current.push({ x: e.screenX, y: e.screenY, time: performance.now() });
    if (pointerHistoryRef.current.length > 8) {
      pointerHistoryRef.current.shift();
    }

    if (window.desktopAPI?.moveWindowBy) {
      pointerLastScreenRef.current = { x: e.screenX, y: e.screenY };
      if (screenDx !== 0 || screenDy !== 0) {
        window.desktopAPI.moveWindowBy(screenDx, screenDy);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isGrabbingRef.current) return;
    isGrabbingRef.current = false;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    let releaseVx = 0;
    let releaseVy = 0;
    const now = performance.now();
    const recent = pointerHistoryRef.current.filter((pt) => now - pt.time <= 80);
    if (recent.length >= 2) {
      const first = recent[0];
      const last = recent[recent.length - 1];
      if (now - last.time <= 40) {
        const dt = (last.time - first.time) / 1000;
        if (dt > 0.008) {
          releaseVx = (last.x - first.x) / dt;
          releaseVy = (last.y - first.y) / dt;
        }
      }
    }
    pointerHistoryRef.current = [];

    if (dragStartedRef.current) {
      onControlsChange((prev) => ({
        ...prev,
        animationState: 'idle',
        emotion: 'happy',
        isGrabbed: false,
      }));
      window.dispatchEvent(
        new CustomEvent('appu-released-with-velocity', {
          detail: { vx: releaseVx, vy: releaseVy },
        })
      );
    } else {
      onControlsChange((prev) => ({ ...prev, isGrabbed: false }));
    }
    dragStartedRef.current = false;
  };

  const flipHorizontal = controls.rotation < -0.35;

  return (
    <div
      className={`video-character-stage is-companion ${controls.isGrabbed ? 'is-grabbed' : ''}`}
      data-testid="video-character-stage"
      data-character-id={characterId}
      data-animation-key={resolved.key}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <video
        ref={videoRef}
        src={activeEntry.file}
        autoPlay={controls.isPlaying}
        loop={activeEntry.loop}
        muted
        playsInline
        crossOrigin="anonymous"
        onLoadedData={(e) => {
          setVideoReady(true);
          if (typeof activeEntry.startTime === 'number' && activeEntry.startTime > 0) {
            e.currentTarget.currentTime = activeEntry.startTime;
          }
        }}
        onTimeUpdate={(e) => {
          if (typeof activeEntry.endTime !== 'number') return;
          if (e.currentTarget.currentTime >= activeEntry.endTime) {
            if (activeEntry.loop) {
              e.currentTarget.currentTime = activeEntry.startTime || 0;
            } else if (!endedTriggeredRef.current) {
              endedTriggeredRef.current = true;
              onAnimationEnded?.();
            }
          }
        }}
        onEnded={() => {
          if (!activeEntry.loop && !endedTriggeredRef.current) {
            endedTriggeredRef.current = true;
            onAnimationEnded?.();
          }
        }}
        className={
          useDirectAlpha || webglFailed
            ? 'video-character-media is-visible'
            : 'video-character-media is-hidden-source'
        }
        style={{
          transform: flipHorizontal ? 'scaleX(-1)' : undefined,
        }}
      />

      {!useDirectAlpha && !webglFailed && (
        <canvas
          ref={canvasRef}
          className={`video-character-canvas ${videoReady ? 'is-ready' : ''}`}
          style={{
            transform: flipHorizontal ? 'scaleX(-1)' : undefined,
          }}
        />
      )}
    </div>
  );
};
