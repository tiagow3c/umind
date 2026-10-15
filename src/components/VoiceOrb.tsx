import { useEffect, useRef } from "react";

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
const FRAG = `precision highp float;
uniform vec2 r;uniform float t;uniform float lv;uniform float act;uniform vec3 c1;uniform vec3 c2;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.02;a*=.5;}return v;}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*r)/min(r.x,r.y);
 float d=length(uv);
 float ang=atan(uv.y,uv.x);
 float wob=(fbm(vec2(ang*1.5,t*.6))-.5)*(.04+.18*lv);
 float rad=.32+.07*lv+.012*sin(t*1.3)*act+wob;
 float mask=smoothstep(rad,rad-.012,d);
 vec2 q=uv*2.2;
 float f=fbm(q+vec2(t*.15,-t*.1)+fbm(q*1.5-t*.2+lv*2.));
 vec3 col=mix(c1,c2,smoothstep(.25,.8,f+uv.y*.6));
 col+=pow(max(0.,1.-length(uv-vec2(-.1,.14))*3.2),2.)*.45;
 col*=.85+.3*f;
 float glow=exp(-max(d-rad,0.)*14.)*(.15+.45*lv)*(1.-mask);
 vec3 o=col*mask+c2*glow;
 gl_FragColor=vec4(o,max(mask,glow));
}`;

/** ChatGPT-voice style orb: a fluid shader disk that swells with mic level (0..1). */
export function VoiceOrb({ level, active, size = 260 }: { level: number; active: boolean; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = useRef(0);
  target.current = active ? Math.min(1, level * 4) : 0;
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
    gl.uniform3fv(u("c1"), toRgb(styles.getPropertyValue("--primary").trim() || "#222"));
    gl.uniform3fv(u("c2"), toRgb(styles.getPropertyValue("--accent").trim() || "#b5643c"));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = cv.height = size * dpr;
    gl.viewport(0, 0, cv.width, cv.height);
    let lv = 0, act = 0, raf = 0;
    const t0 = performance.now();
    const frame = () => {
      lv += (target.current - lv) * (target.current > lv ? 0.35 : 0.08);
      act += ((activeRef.current ? 1 : 0) - act) * 0.05;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u("r"), cv.width, cv.height);
      gl.uniform1f(u("t"), (performance.now() - t0) / 1000 * (0.6 + act * 0.6 + lv));
      gl.uniform1f(u("lv"), lv);
      gl.uniform1f(u("act"), act);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return <canvas ref={canvas} style={{ width: size, height: size }} className="mx-auto block" aria-hidden />;
}
