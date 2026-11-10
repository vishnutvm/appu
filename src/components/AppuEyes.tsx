import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AppuEmotion } from '../types/character';

// Procedural OLED screen texture matching the exact design storyboard
export const useFaceScreenTexture = (
  emotion: AppuEmotion,
  isBlinking: boolean,
  blinkProgress: number,
  mouthOpen: number,
  eyeOffset: { x: number; y: number }
) => {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 640;
    return c;
  }, []);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [canvas]);

  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  // Gaze is read live (the caller passes a mutable ref object) so following the mouse
  // doesn't need a React re-render per frame
  const eyeOffsetRef = useRef(eyeOffset);
  eyeOffsetRef.current = eyeOffset;

  useEffect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;
    let lastGazeX = Number.NaN;
    let lastGazeY = Number.NaN;
    const isAnimated =
      emotion === 'dizzy' ||
      emotion === 'hurt' ||
      emotion === 'thinking' ||
      emotion === 'sleepy' ||
      emotion === 'curious' ||
      isBlinking;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const elapsed = (performance.now() - startTimeRef.current) / 1000;

      // Clear background
      ctx.clearRect(0, 0, w, h);

      // Deep curved OLED glass bezel
      const padX = 36;
      const padY = 46;
      const cornerRadius = 155;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(padX, padY, w - padX * 2, h - padY * 2, cornerRadius);
      ctx.fillStyle = '#05070d';
      ctx.fill();

      // Specular curved glass reflection
      const grad = ctx.createLinearGradient(0, padY, 0, h - padY);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
      grad.addColorStop(0.16, 'rgba(255, 255, 255, 0.04)');
      grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.4)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      // Eye coordinates with gaze offset
      const gaze = eyeOffsetRef.current;
      lastGazeX = gaze.x;
      lastGazeY = gaze.y;
      const lookX = gaze.x * 40;
      const lookY = -gaze.y * 25;

      const leftEyeX = 338 + lookX;
      const leftEyeY = 286 + lookY;
      const rightEyeX = 686 + lookX;
      const rightEyeY = 286 + lookY;
      const eyeRadius = 96;

      // Blinking scale
      let scaleY = 1.0;
      if (isBlinking) {
        scaleY = Math.max(0.05, 1.0 - Math.sin(blinkProgress * Math.PI) * 0.95);
      }

      // Draw helper: 4-pointed golden sparkle star
      const drawSparkle = (sx: number, sy: number, size: number, angle: number = 0) => {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.fillStyle = '#ffdf70';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          ctx.lineTo(Math.cos((i * Math.PI) / 2) * size, Math.sin((i * Math.PI) / 2) * size);
          ctx.lineTo(
            Math.cos((i * Math.PI) / 2 + Math.PI / 4) * (size * 0.28),
            Math.sin((i * Math.PI) / 2 + Math.PI / 4) * (size * 0.28)
          );
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      const drawEye = (
        cx: number,
        cy: number,
        radius: number,
        sY: number,
        emo: AppuEmotion,
        isRightEye: boolean
      ) => {
        ctx.save();
        ctx.translate(cx, cy);

        // Blink override (unless squinted hurt)
        if (sY <= 0.18 && emo !== 'hurt') {
          ctx.scale(1, 0.08);
          ctx.strokeStyle = '#ffb300';
          ctx.lineWidth = 18;
          ctx.lineCap = 'round';
          ctx.shadowColor = '#ff8800';
          ctx.shadowBlur = 32;
          ctx.beginPath();
          ctx.moveTo(-radius * 0.88, 0);
          ctx.lineTo(radius * 0.88, 0);
          ctx.stroke();
          ctx.restore();
          return;
        }

        ctx.scale(1, sY);

        if (emo === 'neutral') {
          // Broad glowing golden rings exactly as depicted on reference sheet
          ctx.shadowColor = '#ff9900';
          ctx.shadowBlur = 38;

          // Outer glow
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffae00';
          ctx.lineWidth = 26;
          ctx.stroke();

          // Inner core line
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.strokeStyle = '#fff0c0';
          ctx.lineWidth = 8;
          ctx.stroke();

          // Subtle dark center with slight warm inner glow
          const radGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.8);
          radGrad.addColorStop(0, 'rgba(255, 170, 0, 0.2)');
          radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (emo === 'happy') {
          // Inverted golden arcs
          ctx.strokeStyle = '#ffaa00';
          ctx.lineWidth = 26;
          ctx.lineCap = 'round';
          ctx.shadowColor = '#ff8800';
          ctx.shadowBlur = 36;
          ctx.beginPath();
          ctx.arc(0, radius * 0.42, radius * 0.74, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();

          ctx.strokeStyle = '#fff5d4';
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.arc(0, radius * 0.42, radius * 0.74, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        } else if (emo === 'curious') {
          // Tilted ring eyes with high pupil focus
          const tilt = isRightEye ? -0.16 : 0.16;
          ctx.rotate(tilt);
          ctx.shadowColor = '#ff9900';
          ctx.shadowBlur = 34;

          ctx.beginPath();
          ctx.ellipse(0, 0, radius * 0.92, radius * 1.05, 0, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffae00';
          ctx.lineWidth = 24;
          ctx.stroke();

          ctx.beginPath();
          ctx.ellipse(0, 0, radius * 0.92, radius * 1.05, 0, 0, Math.PI * 2);
          ctx.strokeStyle = '#fff0c0';
          ctx.lineWidth = 7;
          ctx.stroke();

          // Tiny luminous center focus pupil
          ctx.beginPath();
          ctx.arc(0, -radius * 0.12, 14, 0, Math.PI * 2);
          ctx.fillStyle = '#ffea9f';
          ctx.fill();
        } else if (emo === 'thinking') {
          // One eye arched / looking up-away
          if (!isRightEye) {
            ctx.strokeStyle = '#ffae00';
            ctx.lineWidth = 24;
            ctx.lineCap = 'round';
            ctx.shadowColor = '#ff8800';
            ctx.shadowBlur = 32;
            ctx.beginPath();
            ctx.arc(0, -radius * 0.1, radius * 0.78, Math.PI * 0.15, Math.PI * 0.85);
            ctx.stroke();
          } else {
            ctx.shadowColor = '#ff9900';
            ctx.shadowBlur = 34;
            ctx.beginPath();
            ctx.arc(radius * 0.15, -radius * 0.22, radius * 0.88, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffae00';
            ctx.lineWidth = 24;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(radius * 0.15, -radius * 0.22, radius * 0.88, 0, Math.PI * 2);
            ctx.strokeStyle = '#fff0c0';
            ctx.lineWidth = 7;
            ctx.stroke();
          }
        } else if (emo === 'confused') {
          // Circular ring with one smaller and asymmetric
          const s = isRightEye ? 0.74 : 1.05;
          ctx.scale(s, s);
          ctx.rotate(isRightEye ? -0.2 : 0.1);
          ctx.shadowColor = '#ff9900';
          ctx.shadowBlur = 32;
          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffae00';
          ctx.lineWidth = 22;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
          ctx.strokeStyle = '#fff0c0';
          ctx.lineWidth = 7;
          ctx.stroke();
        } else if (emo === 'surprised') {
          // Fully expanded glowing solid circle/ring
          ctx.shadowColor = '#ffaa00';
          ctx.shadowBlur = 40;
          ctx.beginPath();
          ctx.arc(0, 0, radius * 1.1, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffb300';
          ctx.lineWidth = 24;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, radius * 0.52, 0, Math.PI * 2);
          ctx.fillStyle = '#fff4d0';
          ctx.fill();
        } else if (emo === 'hurt') {
          // Squinted sharp >< angle eyes as depicted in storyboard!
          ctx.strokeStyle = '#ffb300';
          ctx.lineWidth = 26;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = '#ff7700';
          ctx.shadowBlur = 38;

          const armW = radius * 0.72;
          const armH = radius * 0.48;

          ctx.beginPath();
          if (!isRightEye) {
            // Left eye forms ">"
            ctx.moveTo(-armW, -armH);
            ctx.lineTo(armW * 0.45, 0);
            ctx.lineTo(-armW, armH);
          } else {
            // Right eye forms "<"
            ctx.moveTo(armW, -armH);
            ctx.lineTo(-armW * 0.45, 0);
            ctx.lineTo(armW, armH);
          }
          ctx.stroke();

          // Inner bright core
          ctx.strokeStyle = '#fff0c0';
          ctx.lineWidth = 10;
          ctx.stroke();
        } else if (emo === 'dizzy') {
          // Animated spiral / swirl eyes (@ @)
          ctx.shadowColor = '#ff9900';
          ctx.shadowBlur = 36;
          ctx.strokeStyle = '#ffae00';
          ctx.lineWidth = 18;
          ctx.lineCap = 'round';

          const rot = elapsed * (isRightEye ? -4.5 : 4.5);
          ctx.rotate(rot);

          // Draw Archimedean spiral
          ctx.beginPath();
          const maxTheta = Math.PI * 4.2;
          const b = (radius * 0.88) / maxTheta;
          for (let th = 0.5; th <= maxTheta; th += 0.12) {
            const r = b * th;
            const x = r * Math.cos(th);
            const y = r * Math.sin(th);
            if (th === 0.5) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Bright center core
          ctx.strokeStyle = '#fff5d4';
          ctx.lineWidth = 6;
          ctx.stroke();
        } else if (emo === 'sleepy') {
          // Gentle downward curved arches with half-lids
          ctx.strokeStyle = '#ffae00';
          ctx.lineWidth = 22;
          ctx.lineCap = 'round';
          ctx.shadowColor = '#ff8800';
          ctx.shadowBlur = 28;
          ctx.beginPath();
          ctx.arc(0, -radius * 0.28, radius * 0.78, Math.PI * 0.18, Math.PI * 0.82);
          ctx.stroke();

          ctx.strokeStyle = '#fff0c0';
          ctx.lineWidth = 7;
          ctx.stroke();
        } else if (emo === 'bored') {
          // Half-closed straight heavy eyelids
          ctx.strokeStyle = '#ffae00';
          ctx.lineWidth = 20;
          ctx.lineCap = 'round';
          ctx.shadowColor = '#ff8800';
          ctx.shadowBlur = 26;
          ctx.beginPath();
          ctx.moveTo(-radius * 0.8, -radius * 0.1);
          ctx.lineTo(radius * 0.8, -radius * 0.1);
          ctx.stroke();

          // Small low half-circle pupil
          ctx.beginPath();
          ctx.arc(0, radius * 0.15, radius * 0.45, 0, Math.PI);
          ctx.strokeStyle = '#fff0c0';
          ctx.lineWidth = 6;
          ctx.stroke();
        } else if (emo === 'excited') {
          // Extra wide bright curved arcs with sparkles
          ctx.strokeStyle = '#ffaa00';
          ctx.lineWidth = 28;
          ctx.lineCap = 'round';
          ctx.shadowColor = '#ffaa00';
          ctx.shadowBlur = 42;
          ctx.beginPath();
          ctx.arc(0, radius * 0.38, radius * 0.82, Math.PI * 1.12, Math.PI * 1.88);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.arc(0, radius * 0.38, radius * 0.82, Math.PI * 1.12, Math.PI * 1.88);
          ctx.stroke();
        } else if (emo === 'sad') {
          // Downward drooping sad eyes
          const tilt = isRightEye ? -0.22 : 0.22;
          ctx.rotate(tilt);
          ctx.strokeStyle = '#ff9900';
          ctx.lineWidth = 22;
          ctx.lineCap = 'round';
          ctx.shadowColor = '#ff7700';
          ctx.shadowBlur = 28;
          ctx.beginPath();
          ctx.arc(0, -radius * 0.1, radius * 0.75, Math.PI * 0.2, Math.PI * 0.8);
          ctx.stroke();

          ctx.strokeStyle = '#ffd880';
          ctx.lineWidth = 7;
          ctx.stroke();
        } else if (emo === 'shy') {
          // Bashful happy squint
          ctx.strokeStyle = '#ffb020';
          ctx.lineWidth = 22;
          ctx.lineCap = 'round';
          ctx.shadowColor = '#ff8800';
          ctx.shadowBlur = 30;
          ctx.beginPath();
          ctx.arc(0, radius * 0.45, radius * 0.68, Math.PI * 1.2, Math.PI * 1.8);
          ctx.stroke();

          ctx.strokeStyle = '#fff5d4';
          ctx.lineWidth = 8;
          ctx.stroke();
        } else if (emo === 'focused') {
          // Narrowed concentrated slit eyes with curved upper eyelid
          ctx.strokeStyle = '#ffae00';
          ctx.lineWidth = 22;
          ctx.lineCap = 'round';
          ctx.shadowColor = '#ff9900';
          ctx.shadowBlur = 30;
          ctx.beginPath();
          ctx.moveTo(-radius * 0.82, -8);
          ctx.quadraticCurveTo(0, 16, radius * 0.82, -8);
          ctx.stroke();

          ctx.strokeStyle = '#fff0c0';
          ctx.lineWidth = 7;
          ctx.stroke();
        } else if (emo === 'wink') {
          if (isRightEye) {
            // Closed wink slit
            ctx.strokeStyle = '#ffb300';
            ctx.lineWidth = 20;
            ctx.lineCap = 'round';
            ctx.shadowColor = '#ff8800';
            ctx.shadowBlur = 32;
            ctx.beginPath();
            ctx.moveTo(-radius * 0.85, 0);
            ctx.lineTo(radius * 0.85, 0);
            ctx.stroke();
          } else {
            // Open ring
            ctx.shadowColor = '#ff9900';
            ctx.shadowBlur = 36;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffae00';
            ctx.lineWidth = 26;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#fff0c0';
            ctx.lineWidth = 8;
            ctx.stroke();
          }
        }

        ctx.restore();
      };

      // Draw Left and Right Eyes
      drawEye(leftEyeX, leftEyeY, eyeRadius, scaleY, emotion, false);
      drawEye(rightEyeX, rightEyeY, eyeRadius, scaleY, emotion, true);

      // Emotion-specific overlays / accents (sparks, question mark, thought dots, Zz)
      if (emotion === 'hurt') {
        // Impact yellow spark bursts over forehead / brow
        const sparkPulse = 0.85 + Math.sin(elapsed * 12) * 0.15;
        drawSparkle(leftEyeX - 40, leftEyeY - 95, 26 * sparkPulse, elapsed * 2);
        drawSparkle(rightEyeX + 40, rightEyeY - 95, 26 * sparkPulse, -elapsed * 2);
        drawSparkle(512, 175, 18 * sparkPulse, elapsed * 3);
      } else if (emotion === 'dizzy') {
        // Orbiting halo of golden stars
        const starCount = 3;
        for (let i = 0; i < starCount; i++) {
          const a = elapsed * 3.5 + (i * (Math.PI * 2)) / starCount;
          const sx = 512 + Math.cos(a) * 220;
          const sy = 165 + Math.sin(a) * 35;
          drawSparkle(sx, sy, 22, a * 2);
        }
      } else if (emotion === 'curious' || emotion === 'confused') {
        // Small floating golden question mark '?' near right ear
        ctx.save();
        ctx.font = 'bold 54px system-ui, sans-serif';
        ctx.fillStyle = '#ffcf50';
        ctx.shadowColor = '#ff9900';
        ctx.shadowBlur = 24;
        const bobY = Math.sin(elapsed * 4) * 6;
        ctx.fillText('?', rightEyeX + 90, rightEyeY - 60 + bobY);
        ctx.restore();
      } else if (emotion === 'thinking') {
        // Three animated thinking dots '...'
        ctx.save();
        ctx.fillStyle = '#ffcf50';
        ctx.shadowColor = '#ff9900';
        ctx.shadowBlur = 20;
        for (let i = 0; i < 3; i++) {
          const dotPulse = (Math.sin(elapsed * 5 - i * 0.8) + 1) * 0.5;
          ctx.beginPath();
          ctx.arc(rightEyeX + 75 + i * 26, rightEyeY - 80 - dotPulse * 8, 7 + dotPulse * 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (emotion === 'sleepy') {
        // Subtle drifting 'Z z'
        ctx.save();
        ctx.font = 'bold 42px system-ui, sans-serif';
        ctx.fillStyle = '#ffb300';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 18;
        const drift = (elapsed * 25) % 80;
        ctx.globalAlpha = Math.max(0, 1 - drift / 80);
        ctx.fillText('Z', rightEyeX + 80 + drift * 0.5, rightEyeY - 40 - drift);
        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.fillText('z', rightEyeX + 110 + drift * 0.6, rightEyeY - 20 - drift * 0.8);
        ctx.restore();
      } else if (emotion === 'bored') {
        // Flat floating '...' above head
        ctx.save();
        ctx.fillStyle = '#94a3b8';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 12;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(rightEyeX + 85 + i * 22, rightEyeY - 70, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (emotion === 'excited') {
        // Twinkling stars around eyes
        const p = Math.sin(elapsed * 10) * 0.2 + 0.8;
        drawSparkle(leftEyeX - 60, leftEyeY - 70, 20 * p, elapsed * 3);
        drawSparkle(rightEyeX + 60, rightEyeY - 70, 20 * p, -elapsed * 3);
      } else if (emotion === 'shy') {
        // Rosy gold cheek blushes
        ctx.save();
        ctx.fillStyle = 'rgba(255, 120, 80, 0.45)';
        ctx.shadowColor = '#ff6050';
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.ellipse(leftEyeX - 45, leftEyeY + 95, 42, 16, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(rightEyeX + 45, rightEyeY + 95, 42, 16, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Small expressive OLED mouth
      ctx.save();
      ctx.translate(512 + lookX * 0.35, 465 + lookY * 0.25);

      if (mouthOpen > 0.05) {
        ctx.fillStyle = '#0f141d';
        ctx.strokeStyle = '#ffae00';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.ellipse(0, 0, 38 + mouthOpen * 18, 16 + mouthOpen * 24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (emotion === 'happy' || emotion === 'wink') {
        // Cute upturned smile
        ctx.strokeStyle = '#ffae00';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, -20, 48, Math.PI * 0.26, Math.PI * 0.74, false);
        ctx.stroke();
      } else if (emotion === 'surprised') {
        // Small rounded 'o'
        ctx.strokeStyle = '#ffae00';
        ctx.lineWidth = 6;
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 20, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (emotion === 'hurt' || emotion === 'sad') {
        // Downturned concerned/pained/sad mouth
        ctx.strokeStyle = '#ffae00';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#ff7700';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 24, 42, Math.PI * 1.25, Math.PI * 1.75, false);
        ctx.stroke();
      } else if (emotion === 'dizzy') {
        // Wobbly squiggly mouth
        ctx.strokeStyle = '#ffae00';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(-36, Math.sin(elapsed * 10) * 4);
        ctx.quadraticCurveTo(-18, -8, 0, 0);
        ctx.quadraticCurveTo(18, 8, 36, Math.cos(elapsed * 10) * 4);
        ctx.stroke();
      } else if (emotion === 'confused') {
        // Wavy furrowed mouth
        ctx.strokeStyle = '#ffae00';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 20, 38, Math.PI * 1.28, Math.PI * 1.72, false);
        ctx.stroke();
      } else if (emotion === 'sleepy' || emotion === 'focused') {
        ctx.strokeStyle = '#ffae00';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, -10, 32, Math.PI * 0.3, Math.PI * 0.7, false);
        ctx.stroke();
      } else {
        // Neutral polite micro-smile
        ctx.strokeStyle = '#ffae00';
        ctx.lineWidth = 6.5;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, -18, 44, Math.PI * 0.28, Math.PI * 0.72, false);
        ctx.stroke();
      }
      ctx.restore();

      texture.needsUpdate = true;
    };

    // Redraw every frame only while animated; otherwise only when the gaze has visibly moved
    const loop = () => {
      if (!isRunning) return;
      const gaze = eyeOffsetRef.current;
      if (isAnimated || Math.abs(gaze.x - lastGazeX) > 0.004 || Math.abs(gaze.y - lastGazeY) > 0.004) {
        render();
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    render();
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [canvas, texture, emotion, isBlinking, blinkProgress, mouthOpen]);

  return texture;
};
