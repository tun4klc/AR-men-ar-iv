"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Canlı espresso yüzeyi: kremanın yavaşça döndüğü, tepeden görülen bir fincan.
 * WebGL ile gerçek zamanlı çizilir (video dosyası gerekmez, mobil veride hızlı açılır).
 * NEXT_PUBLIC_MENU_HERO_VIDEO tanımlıysa video bunun üstünde oynar; shader onun posteri olur.
 */

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

const FRAG = `
precision mediump float;
uniform vec2 r;uniform float t;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*r)/min(r.x,r.y);
  uv.y+=.12;
  float d=length(uv);
  float sw=t*.045+.9/(d+.55);
  vec2 p=mat2(cos(sw),-sin(sw),sin(sw),cos(sw))*uv;
  vec2 q=vec2(fbm(p*2.+t*.03),fbm(p*2.+vec2(5.2,1.3)-t*.025));
  float f=fbm(p*2.4+q*2.3);
  vec3 dark=vec3(.10,.055,.035),mid=vec3(.36,.19,.09),crema=vec3(.74,.50,.29),foam=vec3(.95,.86,.72);
  vec3 c=mix(dark,mid,smoothstep(.28,.58,f));
  c=mix(c,crema,smoothstep(.52,.72,f));
  c=mix(c,foam,smoothstep(.70,.9,f)*.75);
  float g=fbm(p*3.2+q*3.+t*.02);
  c+=smoothstep(.6,.64,g)*smoothstep(.7,.64,g)*.18;
  float rim=smoothstep(.98,1.0,d)*smoothstep(1.08,1.0,d);
  c=mix(c,vec3(.93,.88,.82),rim*.35);
  c*=1.-smoothstep(.55,1.05,d)*.92;
  gl_FragColor=vec4(c,1.);
}`;

export function EspressoHero({ videoUrl }: { videoUrl?: string }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [gl, setGl] = useState(true);
  const [videoOk, setVideoOk] = useState(Boolean(videoUrl));

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("webgl", { antialias: false, powerPreference: "low-power" });
    if (!ctx) { setGl(false); return; }

    const sh = (type: number, src: string) => {
      const s = ctx.createShader(type)!; ctx.shaderSource(s, src); ctx.compileShader(s); return s;
    };
    const prog = ctx.createProgram()!;
    ctx.attachShader(prog, sh(ctx.VERTEX_SHADER, VERT));
    ctx.attachShader(prog, sh(ctx.FRAGMENT_SHADER, FRAG));
    ctx.linkProgram(prog);
    if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) { setGl(false); return; }
    ctx.useProgram(prog);
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW);
    const loc = ctx.getAttribLocation(prog, "a");
    ctx.enableVertexAttribArray(loc);
    ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
    const uR = ctx.getUniformLocation(prog, "r");
    const uT = ctx.getUniformLocation(prog, "t");

    // Yarım çözünürlük: yüzey zaten yumuşak, telefonda pil ve ısı dostu.
    const resize = () => {
      const k = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
      el.width = Math.max(1, Math.round(el.clientWidth * k));
      el.height = Math.max(1, Math.round(el.clientHeight * k));
      ctx.viewport(0, 0, el.width, el.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);

    let raf = 0, last = 0;
    const start = performance.now() - 40_000 * Math.random();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden || now - last < 33) return; // ~30 fps yeter
      last = now;
      ctx.uniform2f(uR, el.width, el.height);
      ctx.uniform1f(uT, (now - start) / 1000);
      ctx.drawArrays(ctx.TRIANGLES, 0, 3);
    };
    if (still) { ctx.uniform2f(uR, el.width, el.height); ctx.uniform1f(uT, 12); ctx.drawArrays(ctx.TRIANGLES, 0, 3); }
    else raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("resize", resize);
      ctx.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div className="espresso" aria-hidden>
      {gl ? <canvas ref={canvas} className="espresso-canvas" /> : <div className="espresso-canvas espresso-fallback" />}
      {videoUrl && videoOk && (
        <video className="espresso-canvas espresso-video" src={videoUrl} autoPlay muted loop playsInline
          preload="auto" onError={() => setVideoOk(false)} />
      )}
      <div className="steam">
        <span /><span /><span />
      </div>
    </div>
  );
}
