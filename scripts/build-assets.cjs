#!/usr/bin/env node
// Builds the README art (animated SVGs) from the mod's own drawing code, so the
// screenshots can never drift from what the mod really draws.
//
//   npm i --no-save typescript@5.6.3 && node scripts/build-assets.cjs
//
// Writes docs/hero.svg, docs/social.svg and plugins/live-status/docs/*.svg.
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const modDir = path.join(root, 'plugins', 'live-status')
const outMod = path.join(modDir, 'docs')
const outRoot = path.join(root, 'docs')
fs.mkdirSync(outMod, { recursive: true })
fs.mkdirSync(outRoot, { recursive: true })

// --- load the mod's drawing functions without the engine ---------------------
const src = fs.readFileSync(path.join(modDir, 'hooks', 'register.tsx'), 'utf8').replace(/\r\n/g, '\n')
const body =
  src
    .replace(/^import \{ atom, read, update \} from 'claude-code'\n/m, 'const atom = () => ({}), read = async () => null, update = async () => null\n')
    .replace(/^import type .*\n/gm, '') + '\nexports.api = { cardSvg, agentSvg, statsSvg, sessionSvg, sectionSvg, CSS, PANE_CSS, FONT }\n'
const js = ts.transpileModule(body, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: 'h' },
}).outputText
const mod = { exports: {} }
new Function('exports', 'module', 'require', 'h', js)(mod.exports, mod, require, () => null)
const { cardSvg, agentSvg, statsSvg, sessionSvg, sectionSvg, CSS, PANE_CSS, FONT } = mod.exports.api

// --- helpers -----------------------------------------------------------------
const write = (dir, name, svg) => fs.writeFileSync(path.join(dir, name), svg)

// Make ids and keyframe names unique per nested drawing.
function uniq(svg, k) {
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(m => m[1])
  const kfs = [...svg.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1])
  let out = svg
  for (const id of new Set(ids)) out = out.split(`id="${id}"`).join(`id="${id}_${k}"`).split(`url(#${id})`).join(`url(#${id}_${k})`)
  for (const n of new Set(kfs)) {
    out = out.replace(new RegExp(`@keyframes ${n}\\b`, 'g'), `@keyframes ${n}_${k}`).replace(new RegExp(`animation:${n}\\b`, 'g'), `animation:${n}_${k}`)
  }
  return out
}

// Turn a standalone <svg> into a nested one at (x, y).
const nest = (svg, x, y) => svg.replace(/^<svg xmlns="[^"]+"/, `<svg x="${x}" y="${y}"`)

// The dark half of the mod's CSS, forced on (the hero is always dark).
function forceDark(css) {
  // Every `@media (prefers-color-scheme: dark){ ... }` block, matched by brace depth.
  const parts = css.split('@media (prefers-color-scheme: dark){').slice(1)
  const rules = parts.map(seg => {
    let depth = 1
    for (let i = 0; i < seg.length; i++) {
      if (seg[i] === '{') depth++
      else if (seg[i] === '}' && --depth === 0) return seg.slice(0, i)
    }
    return seg
  })
  return rules.join('\n').replace(/#([0-9A-Fa-f]{3,8})(?=[;}])/g, '#$1!important')
}

const nowMs = 0 // animation phase is irrelevant for static art

const gauge = (label, pct, caption, sheen = false) => ({ label, pct, caption, sheen })
const base = {
  stack: false,
  name: 'Opus 5.5',
  fx: 'high',
  cost: '$1.23',
  isRunning: true,
  nowMs,
  agents: { rows: [], working: 0, more: 0 },
}

// --- the live demo: one card moving through a whole turn ---------------------
const frames = [
  { dur: 1.6, state: 'Idle', detail: 'last turn 1:12 · 9 steps', run: false, ctx: 12, h5: 30, d7: 12, task: null, label: 'Idle' },
  ...[0, 1, 2, 3, 4].map(i => ({
    dur: 1.6,
    state: 'Working',
    detail: `0:${String(8 + i * 9).padStart(2, '0')} · ${i + 2} steps · ${i * 3 + 2} tools`,
    run: true,
    ctx: [14, 23, 33, 44, 55][i],
    h5: 30 + i,
    d7: 12,
    task: { title: 'Ship the redesign', done: i, total: 5, current: ['Plan', 'Build the card', 'Wire the hooks', 'Test responsive', 'Write README'][i], isFinished: false },
  })),
  { dur: 2.2, state: 'Idle', detail: 'last turn 0:58 · 11 steps', run: false, ctx: 58, h5: 35, d7: 12, task: { title: 'Ship the redesign', done: 5, total: 5, current: '', isFinished: true } },
]

function frameSvg(f, W) {
  const gauges = [
    gauge('CONTEXT', f.ctx, `${Math.round(f.ctx * 10)}k of 1.0M`, true),
    gauge('5H', f.h5, 'resets in 2h10m'),
    gauge('7D', f.d7, 'resets in 4d3h'),
  ]
  return cardSvg({
    ...base,
    W,
    state: f.state,
    detail: f.detail,
    isRunning: f.run,
    gauges,
    task: f.task,
  })
}

function demoSvg() {
  const W = 760
  const built = frames.map((f, i) => ({ f, ...frameSvg(f, W) }))
  const H = Math.max(...built.map(b => b.H))
  const loop = frames.reduce((s, f) => s + f.dur, 0)
  const fade = 0.35
  let t = 0
  const groups = built
    .map((b, i) => {
      const start = t
      t += b.f.dur
      const end = t
      const a = (start / loop).toFixed(4)
      const b1 = ((start + fade) / loop).toFixed(4)
      const c = Math.min(1, (end - 0.001) / loop).toFixed(4)
      const d = Math.min(1, (end + fade) / loop).toFixed(4)
      // first frame starts visible, last frame fades back into it
      const op = i === 0 ? '1' : '0'
      // Frame 0 stays underneath at all times; each later frame fades in on top of
      // the previous one (which stays opaque below), so text never double-exposes.
      void c
      void d
      const anim =
        i === 0
          ? ''
          : i === built.length - 1
            ? `<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${a};${b1};${(1 - fade / loop).toFixed(4)};1" dur="${loop}s" repeatCount="indefinite"/>`
            : `<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${a};${b1};${d};${Math.min(1, +d + 0.0001).toFixed(4)};1" dur="${loop}s" repeatCount="indefinite"/>`
      return `<g opacity="${i === 0 ? '1' : op}">${anim}${nest(uniq(b.svg, 'f' + i), 0, 0)}</g>`
    })
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="The live-status monitor moving through a turn: idle, working through five steps with the task bar filling, then done">\n${groups}\n</svg>\n`
}

// --- hero --------------------------------------------------------------------
function heroSvg({ W = 1280, H = 400, social = false }) {
  const cardW = 600
  const monitor = cardSvg({
    ...base,
    W: cardW,
    state: 'Working',
    detail: '0:42 · 5 steps · 7 tools · 2 agents',
    isRunning: true,
    gauges: [gauge('CONTEXT', 46, '460k of 1.0M', true), gauge('5H', 68, 'resets in 2h10m'), gauge('7D', 24, 'resets in 4d3h')],
    task: { title: 'Ship the redesign', done: 3, total: 5, current: 'Test responsive', isFinished: false },
  })
  const aW = (cardW - 14) / 2
  const mkRun = (o) => ({
    type: 'deep-fixer',
    model: 'claude-opus-5-5',
    effort: 'high',
    startedAt: -90000,
    contextMax: 1000000,
    ...o,
  })
  const a1 = agentSvg(aW, mkRun({ id: 'a', description: 'Refactor auth', status: 'running', contextTokens: 340000, tokens: 612000, steps: 14 }), 0, 0)
  const a2 = agentSvg(aW, mkRun({ id: 'b', description: 'Write README', status: 'done', endedAt: 30000, contextTokens: 180000, tokens: 240000, steps: 6 }), 0, 0)

  const stackH = monitor.H + 14 + 100
  const cx = W - cardW - 72
  const cy = Math.round((H - stackH) / 2) + (social ? 6 : 0)

  const tx = 72
  const ty0 = social ? 150 : 112
  const dark = forceDark(CSS) + forceDark(PANE_CSS)
  const mono = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="claude-mods: a collection of mods for Claude Code. Preview of the live-status monitor and agents panel.">
<defs>
  <linearGradient id="hbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#101012"/><stop offset="1" stop-color="#1B1812"/></linearGradient>
  <radialGradient id="hg1" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFBC25" stop-opacity=".34"/><stop offset="1" stop-color="#FFBC25" stop-opacity="0"/></radialGradient>
  <radialGradient id="hg2" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#7C79E8" stop-opacity=".30"/><stop offset="1" stop-color="#7C79E8" stop-opacity="0"/></radialGradient>
  <pattern id="hdots" width="26" height="26" patternUnits="userSpaceOnUse">
    <circle cx="1.5" cy="1.5" r="1.1" fill="#fff" opacity=".07"/>
    <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="26 26" dur="9s" repeatCount="indefinite"/>
  </pattern>
  <linearGradient id="htitle" gradientUnits="userSpaceOnUse" x1="${tx}" y1="0" x2="${tx + 520}" y2="0">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#FFD36B"/><stop offset="1" stop-color="#FFFFFF"/>
    <animateTransform attributeName="gradientTransform" type="translate" values="-260 0;260 0;-260 0" dur="8s" repeatCount="indefinite"/>
  </linearGradient>
  <clipPath id="hclip"><rect width="${W}" height="${H}" rx="22"/></clipPath>
  <filter id="hblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="46"/></filter>
  <filter id="hshadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000" flood-opacity=".5"/></filter>
</defs>
<style>
${dark}
.hmono{font-family:${mono}}
.hcur{animation:hcur 1.1s steps(1) infinite}
@keyframes hcur{50%{opacity:0}}
.hfloat1{animation:hfl 7s cubic-bezier(.45,0,.55,1) infinite}
.hfloat2{animation:hfl 7s cubic-bezier(.45,0,.55,1) infinite;animation-delay:-2.3s}
@keyframes hfl{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.hrise{animation:hrise .9s cubic-bezier(.16,1,.3,1) both}
@keyframes hrise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>
<g clip-path="url(#hclip)">
  <rect width="${W}" height="${H}" fill="url(#hbg)"/>
  <rect width="${W}" height="${H}" fill="url(#hdots)"/>
  <g filter="url(#hblur)">
    <circle cx="${W - 220}" cy="70" r="190" fill="url(#hg1)">
      <animateTransform attributeName="transform" type="translate" values="0 0;-50 34;0 0" dur="12s" repeatCount="indefinite"/>
    </circle>
    <circle cx="200" cy="${H - 40}" r="200" fill="url(#hg2)">
      <animateTransform attributeName="transform" type="translate" values="0 0;60 -30;0 0" dur="14s" repeatCount="indefinite"/>
    </circle>
  </g>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="22" fill="none" stroke="#fff" stroke-opacity=".09"/>

  <g class="hrise" style="animation-delay:.05s">
    <rect x="${tx}" y="${ty0 - 32}" width="214" height="26" rx="13" fill="#FFBC25" fill-opacity=".12" stroke="#FFBC25" stroke-opacity=".35"/>
    <circle cx="${tx + 16}" cy="${ty0 - 19}" r="3.5" fill="#FFBC25"><animate attributeName="opacity" values="1;.35;1" dur="2.4s" repeatCount="indefinite"/></circle>
    <text x="${tx + 29}" y="${ty0 - 14.5}" font-family="${FONT}" font-size="11.5" font-weight="700" letter-spacing="1.6" fill="#FFD36B">MODS FOR CLAUDE CODE</text>
  </g>
  <text class="hrise" style="animation-delay:.15s" x="${tx}" y="${ty0 + 62}" font-family="${FONT}" font-size="72" font-weight="800" letter-spacing="-2" fill="url(#htitle)">claude-mods</text>
  <g class="hrise" style="animation-delay:.28s">
    <text x="${tx}" y="${ty0 + 106}" font-family="${FONT}" font-size="21" font-weight="500" fill="#E8E6E0">Small, beautiful mods that make</text>
    <text x="${tx}" y="${ty0 + 136}" font-family="${FONT}" font-size="21" font-weight="500" fill="#E8E6E0">Claude Code feel <tspan fill="#FFBC25" font-weight="700">alive</tspan>.</text>
  </g>
  <g class="hrise" style="animation-delay:.42s">
    <rect x="${tx}" y="${ty0 + 164}" width="520" height="46" rx="12" fill="#fff" fill-opacity=".06" stroke="#fff" stroke-opacity=".12"/>
    <text class="hmono" x="${tx + 18}" y="${ty0 + 193}" font-size="12" fill="#9AA3AF">$</text>
    <text class="hmono" x="${tx + 34}" y="${ty0 + 193}" font-size="12" fill="#F3F2EE">/plugin install <tspan fill="#FFD36B">live-status</tspan> --marketplace fanoisme/claude-mods</text>
    <rect class="hcur" x="${tx + 34 + 63 * 7.2 + 5}" y="${ty0 + 181}" width="7" height="16" rx="1.5" fill="#FFBC25"/>
  </g>

  <g transform="translate(${cx} ${cy})" filter="url(#hshadow)">
    <g class="hfloat1">${nest(uniq(monitor.svg, 'm'), 0, 0)}</g>
    <g transform="translate(0 ${monitor.H + 14})"><g class="hfloat2">
      ${nest(uniq(a1, 'a'), 0, 0)}
      ${nest(uniq(a2, 'b'), aW + 14, 0)}
    </g></g>
  </g>
</g>
</svg>
`
}

write(outMod, 'demo.svg', demoSvg())
write(outRoot, 'hero.svg', heroSvg({ W: 1280, H: 400 }))
write(outRoot, 'social.svg', heroSvg({ W: 1280, H: 640, social: true }))

// Static stills used in the mod README.
const still = (name, o) => write(outMod, name, cardSvg({ ...base, ...o }).svg)
still('monitor.svg', {
  W: 760,
  state: 'Working',
  detail: '0:42 · 5 steps · 7 tools · 2 agents',
  gauges: [
    gauge('CONTEXT', 42, '420k of 1.0M', true),
    gauge('5H', 68, 'resets in 2h10m'),
    gauge('7D', 91, 'resets in 4d3h'),
    { label: 'RTK SAVED', pct: 40, caption: '16.4K saved · 127', sheen: false, good: true },
  ],
  task: null,
})
still('monitor-idle.svg', {
  W: 760,
  isRunning: false,
  state: 'Idle',
  detail: 'last turn 1:12 · 9 steps',
  gauges: [gauge('CONTEXT', 42, '420k of 1.0M', true), gauge('5H', 68, 'resets in 2h10m'), gauge('7D', 91, 'resets in 4d3h')],
  task: null,
})
still('monitor-narrow.svg', {
  W: 420,
  stack: true,
  state: 'Working',
  detail: '0:42 · 5 steps · 7 tools · 2 agents',
  gauges: [gauge('CONTEXT', 42, '420k of 1.0M', true), gauge('5H', 68, 'resets in 2h10m'), gauge('7D', 91, 'resets in 4d3h')],
  task: { title: 'Ship the redesign', done: 3, total: 5, current: 'Test responsive', isFinished: false },
  agents: {
    rows: [
      { name: 'Refactor auth module', status: 'running', ctx: 34 },
      { name: 'Fix flaky tests', status: 'running', ctx: 71 },
    ],
    working: 2,
    more: 1,
  },
})

const mk = (o) => ({ type: 'deep-fixer', model: 'claude-opus-5-5', effort: 'high', startedAt: -90000, contextMax: 1000000, ...o })
const list = [
  mk({ id: '1', description: 'Refactor auth module', status: 'running', contextTokens: 340000, tokens: 612000, steps: 14 }),
  mk({ id: '2', description: 'Fix flaky tests', status: 'running', contextTokens: 710000, tokens: 902000, steps: 22 }),
  mk({ id: '3', description: 'Write README', status: 'done', endedAt: 30000, contextTokens: 180000, tokens: 240000, steps: 6 }),
]
write(outMod, 'agents-0.svg', statsSvg(520, list, 0))
write(outMod, 'agents-1.svg', agentSvg(520, list[0], 0, 0))
write(outMod, 'agents-2.svg', agentSvg(520, list[1], 0, 0))
write(outMod, 'agents-3.svg', agentSvg(520, list[2], 0, 0))

// All sessions, as the side panel lists them.
const sess = [
  { id: 's1', pid: 1, name: 'Mod redesign', project: 'claude-mods', entry: 'desktop', status: 'busy', updatedAt: -4000, startedAt: 0, isSelf: true, task: { title: 'Ship the redesign', done: 3, total: 5, current: 'Test responsive', isFinished: false } },
  { id: 's2', pid: 2, name: 'API migration', project: 'api', entry: 'desktop', status: 'busy', updatedAt: -12000, startedAt: 0, isSelf: false, task: { title: 'Move endpoints to v2', done: 2, total: 6, current: 'Update the client', isFinished: false } },
  { id: 's3', pid: 3, name: 'Docs site', project: 'docs', entry: 'cli', status: 'idle', updatedAt: -240000, startedAt: 0, isSelf: false },
]
const SW = 520
const parts = []
let y = 0
const put = (svg, h, k) => {
  parts.push(nest(uniq(svg, k), 0, y))
  y += h
}
put(sectionSvg(SW, 'SESSIONS', '2 working · 1 idle', (2 / 3) * 100), 46, 'h1')
sess.forEach((x, i) => put(sessionSvg(SW, x, 0, 0), 104, 's' + i))
put(sectionSvg(SW, 'SUBAGENTS', '1 / 3 finished', (1 / 3) * 100), 46, 'h2')
list.forEach((r, i) => put(agentSvg(SW, r, 0, 0), 108, 'g' + i))
write(
  outMod,
  'sessions.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${y}" viewBox="0 0 ${SW} ${y}" role="img" aria-label="The side panel: a sessions section and a subagents section, each with an overview progress bar">\n${parts.join('\n')}\n</svg>\n`,
)

console.log('built:', [...fs.readdirSync(outRoot).map(f => 'docs/' + f), ...fs.readdirSync(outMod).map(f => 'plugins/live-status/docs/' + f)].join(', '))
