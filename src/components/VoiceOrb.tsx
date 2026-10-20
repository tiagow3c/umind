import { useEffect, useRef } from "react";
import { useTheme } from "@/hooks/use-theme";

/** Resolve any CSS color (incl. oklch) to normalized RGB via a 1px canvas. */
function toRgb(css: string): [number, number, number] {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d")!;
  g.fillStyle = css;
  g.fillRect(0, 0, 1, 1);
  const d = g.getImageData(0, 0, 1, 1).data;
  return [d[0]! / 255, d[1]! / 255, d[2]! / 255];
}

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

/** A soft, flat disc: the two palette tones drifting slowly into each other.
 *  No drop shadow, no halo, no specular highlight — the level only swells the radius. */
const FRAG = `precision highp float;
uniform vec2 r;uniform float t;uniform float lv;uniform vec3 c1;uniform vec3 c2;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*r)/min(r.x,r.y);
 float d=length(uv);
 float rad=.30+.045*lv;
 float mask=smoothstep(rad+.005,rad-.005,d);
 float k=.5+.5*dot(uv/rad,vec2(.62,.78));
 k+=.09*sin(t*.28)+.07*(fbm(uv*1.25+vec2(t*.05,-t*.045))-.5);
 vec3 col=mix(c1,c2,clamp(k,0.,1.));
 col=mix(col,c1,smoothstep(.62,1.,d/rad)*.14);
 gl_FragColor=vec4(col,mask);
}`;

/** Recording indicator: a calm fluid disk that swells gently with mic level (0..1). */
export function VoiceOrb({ level, active, size = 260 }: { level: number; active: boolean; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { dark } = useTheme();
  const target = useRef(0);
  target.current = active ? Math.min(1, level * 3.2) : 0;
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const cv = canvas.current!;
    const gl = cv.getContext("webgl", { premultipliedAlpha: false, alpha: true });
    if (!gl) return;
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram()!;
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr);
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const u = (k: string) => gl.getUniformLocation(pr, k);
    const styles = getComputedStyle(cv);
    gl.uniform3fv(u("c1"), toRgb(styles.getPropertyValue("--orb-a").trim() || "#a85c37"));
    gl.uniform3fv(u("c2"), toRgb(styles.getPropertyValue("--orb-b").trim() || "#e7d5bb"));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = cv.height = size * dpr;
    gl.viewport(0, 0, cv.width, cv.height);
    let lv = 0, act = 0, t = 0, last = performance.now(), raf = 0;
    const frame = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      lv += (target.current - lv) * (target.current > lv ? 0.12 : 0.05);
      act += ((activeRef.current ? 1 : 0) - act) * 0.04;
      t += dt * (0.5 + act * 0.25 + lv * 0.45);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u("r"), cv.width, cv.height);
      gl.uniform1f(u("t"), t);
      gl.uniform1f(u("lv"), lv);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [size, dark]);

  return <canvas ref={canvas} style={{ width: size, height: size }} className="mx-auto block" aria-hidden />;
}
