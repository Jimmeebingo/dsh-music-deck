window.__ModuleLoader__.load({
  id: 'dsh-music-deck',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'music-deck'
    const STYLE_ID = 'music-deck-styles'

    const CSS = `
.mdk-root{position:fixed;right:18px;bottom:18px;z-index:70;pointer-events:auto;font-family:inherit;color:var(--dsw-alias-label-primary);-webkit-font-smoothing:antialiased;cursor:grab;touch-action:none}
.mdk-root[data-snap="1"]{transition:left .18s cubic-bezier(.2,.7,.3,1),top .16s cubic-bezier(.2,.7,.3,1)}
.mdk-root:active{cursor:grabbing}
.mdk-root *{box-sizing:border-box}
.mdk-mini,.mdk-head,.mdk-body,.mdk-meta,.mdk-empty,.mdk-note,.mdk-controls{user-select:none}
.mdk-mini{display:flex;align-items:center;gap:8px;height:56px;padding:6px 8px 6px 6px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:28px;box-shadow:0 6px 22px rgba(0,0,0,.16);cursor:grab;transition:transform .15s ease,box-shadow .15s ease}
.mdk-mini:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(0,0,0,.2)}
.mdk-root:active .mdk-mini{transform:none;box-shadow:0 6px 22px rgba(0,0,0,.16)}
.mdk-disc{flex:none;display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;overflow:hidden;color:#fff;font-weight:600;font-size:13px;line-height:1;letter-spacing:0;box-shadow:0 1px 4px rgba(0,0,0,.2),inset 0 0 0 1px rgba(0,0,0,.06)}
.mdk-disc-lg{width:52px;height:52px;font-size:16px}
.mdk-disc-img{display:block;object-fit:cover;background:var(--dsw-alias-bg-layer-2)}
.mdk-disc-sm{width:34px;height:34px;font-size:11px}
.mdk-card{width:288px;max-width:calc(100vw - 48px);background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;box-shadow:0 14px 38px rgba(0,0,0,.22);overflow:hidden;backdrop-filter:blur(10px)}
.mdk-compact{display:flex;flex-direction:column;gap:3px;width:auto;padding:6px 8px;border-radius:14px}
.mdk-compact-top{display:flex;align-items:center;gap:4px;width:100%}
.mdk-compact-bottom{display:flex;align-items:center;gap:2px;width:100%;justify-content:space-between}
.mdk-compact .mdk-source{font-size:10.5px;padding:2px 3px;gap:4px}
.mdk-compact .mdk-src-label{max-width:98px}
.mdk-compact .mdk-play{width:30px;height:30px}
.mdk-head{display:flex;align-items:center;gap:6px;padding:8px 8px 2px 12px}
.mdk-source{display:inline-flex;align-items:center;gap:5px;min-width:0;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;padding:2px 4px;border-radius:6px;cursor:pointer}
.mdk-source:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.mdk-dot{width:6px;height:6px;border-radius:50%;flex:none}
.mdk-src-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
.mdk-spacer{flex:1}
.mdk-icon{width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;transition:background .12s ease,color .12s ease}
.mdk-icon:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.mdk-icon:disabled{opacity:.36;cursor:default}
.mdk-icon svg{display:block}
.mdk-body{display:flex;gap:10px;align-items:center;padding:2px 12px 8px}
.mdk-meta{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.mdk-meta-title{font-size:13.5px;font-weight:650;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mdk-meta-sub{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mdk-meta-album{font-size:10.5px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mdk-progress{position:relative;height:12px;margin:0 12px;display:flex;align-items:center;cursor:pointer}
.mdk-track{height:3px;width:100%;border-radius:2px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.mdk-fill{height:100%;border-radius:2px;background:var(--dsw-alias-brand-primary);transition:width .3s linear}
.mdk-controls{display:flex;align-items:center;gap:4px;padding:2px 10px 8px}
.mdk-right{margin-left:auto;display:flex;align-items:center;gap:2px}
.mdk-pop{position:absolute;right:0;z-index:3;min-width:186px;padding:8px 10px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.24);color:var(--dsw-alias-label-primary)}
.mdk-pop-title{display:flex;justify-content:space-between;gap:10px;margin-bottom:6px;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.mdk-pop-empty{padding:2px 0 4px;font-size:11.5px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}
.mdk-set-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:5px 0;font-size:11.5px;color:var(--dsw-alias-label-primary);user-select:none}
.mdk-switch{position:relative;flex:none;width:28px;height:16px;border:0;padding:0;border-radius:8px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;transition:background .15s ease}
.mdk-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}
.mdk-switch-thumb{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:left .15s ease}
.mdk-switch[aria-checked="true"] .mdk-switch-thumb{left:14px}
.mdk-restore{display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);box-shadow:0 2px 8px rgba(0,0,0,.2);cursor:pointer;padding:0}
.mdk-restore-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-brand-primary);display:block}
.mdk-menu{position:fixed;z-index:5;min-width:132px;padding:4px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.28);backdrop-filter:blur(10px)}
.mdk-menu-item{display:flex;align-items:center;width:100%;padding:5px 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;text-align:left;cursor:pointer}
.mdk-menu-item:hover{background:var(--dsw-alias-bg-layer-2)}
.mdk-root[data-opaque="1"] .mdk-card,.mdk-root[data-opaque="1"] .mdk-mini,.mdk-root[data-opaque="1"] .mdk-pop,.mdk-root[data-opaque="1"] .mdk-restore,.mdk-root[data-opaque="1"] .mdk-menu{background:var(--dsw-alias-bg-base);backdrop-filter:none}
.mdk-vol-row{display:flex;align-items:center;gap:8px;padding:2px 0 4px}
.mdk-vol{position:relative;flex:1;height:20px;display:flex;align-items:center;cursor:pointer;touch-action:none}
.mdk-vol-track{width:100%;height:4px;border-radius:2px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.mdk-vol-fill{height:100%;background:var(--dsw-alias-brand-primary)}
.mdk-vol-thumb{position:absolute;top:50%;width:12px;height:12px;margin-left:-6px;margin-top:-6px;border-radius:50%;background:var(--dsw-alias-brand-primary);box-shadow:0 1px 3px rgba(0,0,0,.35);pointer-events:none}
.mdk-vol-bubble{position:absolute;bottom:100%;margin-bottom:2px;transform:translateX(-50%);padding:1px 5px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:10px;font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none}
.mdk-play{width:32px;height:32px;border-radius:50%;border:0;background:transparent;color:var(--dsw-alias-label-primary);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;transition:background .12s ease,color .12s ease,opacity .12s ease}
.mdk-mini-play{flex:none}
.mdk-play:hover{background:var(--dsw-alias-bg-layer-2)}
.mdk-play:disabled{opacity:.4;cursor:default}
.mdk-play:disabled:hover{background:transparent}
.mdk-time{margin-right:2px;font-size:10.5px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-variant-numeric:tabular-nums}
.mdk-empty{padding:4px 12px 8px;display:flex;flex-direction:column;gap:4px}
.mdk-empty-title{font-size:12px;font-weight:600}
.mdk-empty-hint{font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
.mdk-note{padding:0 12px 8px;font-size:10.5px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));opacity:.85}
`

    const SERVICES = {
      qq: { label: 'QQ音乐', color: '#31c27c', badge: 'Q' },
      netease: { label: '网易云音乐', color: '#ec4141', badge: '云' },
      spotify: { label: 'Spotify', color: '#1db954', badge: 'S' },
      other: { label: '播放器', color: '#7a7f8a', badge: '♪' },
    }

    function serviceOf(id) {
      const text = String(id || '').toLowerCase()
      if (text.indexOf('qqmusic') >= 0) return 'qq'
      if (text.indexOf('cloudmusic') >= 0 || text.indexOf('netease') >= 0) return 'netease'
      if (text.indexOf('spotify') >= 0) return 'spotify'
      return 'other'
    }

    function hueOf(text) {
      let hash = 0
      const value = String(text || 'music')
      for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) % 360
      }
      return hash
    }

    function coverStyle(track) {
      const key = `${track ? track.title : ''}|${track ? track.artist : ''}`
      const hue = hueOf(key)
      return {
        background: `linear-gradient(135deg, hsl(${hue} 64% 54%), hsl(${(hue + 42) % 360} 68% 40%))`,
      }
    }

    function clock(ms) {
      const total = Math.max(0, Math.round((ms || 0) / 1000))
      const minutes = Math.floor(total / 60)
      const seconds = total % 60
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
    }

    /** Keep the widget inside the viewport; the stored form is side + vertical ratio. */
    function clampNumber(value, min, max) {
      return Math.max(min, Math.min(max, value))
    }

    const DECK_MARGIN = 16
    const COMPACT_BREAKPOINT = 1280
    const DEFAULT_PLACEMENT = { side: 'right', yRatio: 1 }
    const DEFAULT_SETTINGS = { opaque: false, autoCompact: true, exclusive: true }

    function readSettings() {
      try {
        const raw = localStorage.getItem('music-deck.settings')
        if (!raw) return DEFAULT_SETTINGS
        const value = JSON.parse(raw)
        if (!value || typeof value !== 'object') return DEFAULT_SETTINGS
        const merged = { ...DEFAULT_SETTINGS, ...value }
        // An intermediate build stored the inverse under `transparent`.
        if (typeof value.transparent === 'boolean' && typeof value.opaque !== 'boolean') {
          merged.opaque = !value.transparent
        }
        delete merged.transparent
        return merged
      } catch {
        return DEFAULT_SETTINGS
      }
    }

    function saveSettings(settings) {
      try {
        localStorage.setItem('music-deck.settings', JSON.stringify(settings))
      } catch {
        /* storage may be unavailable */
      }
    }

    /** Stored placement: which side gutter, and how far down as a 0..1 ratio. */
    function readPlacement() {
      try {
        const raw = localStorage.getItem('music-deck.placement')
        if (raw) {
          const value = JSON.parse(raw)
          if (value && (value.side === 'left' || value.side === 'right') && Number.isFinite(value.yRatio)) {
            return { side: value.side, yRatio: clampNumber(value.yRatio, 0, 1) }
          }
        }

        // Migrate the pixel anchor the previous version stored once.
        const legacy = localStorage.getItem('music-deck.anchor')
        if (legacy) {
          const value = JSON.parse(legacy)
          localStorage.removeItem('music-deck.anchor')
          if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
            const migrated = {
              side: value.x + 120 < window.innerWidth / 2 ? 'left' : 'right',
              yRatio: clampNumber(value.y / Math.max(1, window.innerHeight), 0, 1),
            }
            savePlacement(migrated)
            return migrated
          }
        }
        return null
      } catch {
        return null
      }
    }

    function savePlacement(placement) {
      try {
        localStorage.setItem('music-deck.placement', JSON.stringify(placement))
      } catch {
        /* storage may be unavailable */
      }
    }

    /** Position for the current viewport and card size: always hugging one side. */
    function resolvePlacement(placement, size, viewport, leftInset) {
      const travel = Math.max(0, viewport.height - size.height - DECK_MARGIN * 2)
      return {
        left:
          placement.side === 'left'
            ? leftInset
            : Math.max(DECK_MARGIN, viewport.width - size.width - DECK_MARGIN),
        top: Math.round(DECK_MARGIN + clampNumber(placement.yRatio, 0, 1) * travel),
      }
    }

    function sideForPointer(x, viewport) {
      return x < viewport.width / 2 ? 'left' : 'right'
    }

    /**
     * Width of the left column (workspace list) so a left-docked card sits beside
     * it instead of on top of it. Measured geometrically: the widest element that
     * hugs the left edge and spans most of the viewport height is that column's
     * outer box (its children are narrower).
     */
    function measureSidebarWidth(viewport) {
      const width = viewport.width
      const height = viewport.height
      let edge = 0
      const queue = []
      if (document.body) {
        for (const child of document.body.children) queue.push([child, 0])
      }
      while (queue.length > 0) {
        const [element, depth] = queue.pop()
        if (depth > 5) continue
        const rect = element.getBoundingClientRect()
        if (
          rect.height >= height * 0.5 &&
          rect.left <= 6 &&
          rect.width >= 40 &&
          rect.width <= width * 0.45 &&
          rect.right > 0
        ) {
          if (rect.right > edge) edge = rect.right
        }
        for (const child of element.children) queue.push([child, depth + 1])
      }
      const sane = edge >= 100 && edge <= width * 0.4
      return sane ? edge : 0
    }

    function leftInsetFor(viewport) {
      return DECK_MARGIN + measureSidebarWidth(viewport)
    }

    /**
     * Windowed layouts get the compact card. A maximised window is roughly as
     * wide as the screen; anything narrower than 86% of it counts as windowed.
     */
    function isCompactViewport(viewport) {
      const screenWidth = window.screen && window.screen.availWidth ? window.screen.availWidth : viewport.width
      return viewport.width < COMPACT_BREAKPOINT || viewport.width < screenWidth * 0.86
    }

    function Icon(props) {
      const common = {
        width: props.size || 15,
        height: props.size || 15,
        viewBox: '0 0 24 24',
        fill: 'currentColor',
        'aria-hidden': true,
      }
      if (props.glyph === 'play') return h('svg', common, h('path', { d: 'M8 5.5v13l11-6.5z' }))
      if (props.glyph === 'pause') return h('svg', common, h('path', { d: 'M7 5h3.4v14H7zm6.6 0H17v14h-3.4z' }))
      if (props.glyph === 'next') {
        return h('svg', common, h('path', { d: 'M6 5.5v13l9-6.5zM16 5h2v14h-2z' }))
      }
      if (props.glyph === 'prev') {
        return h('svg', common, h('path', { d: 'M18 5.5v13l-9-6.5zM6 5h2v14H6z' }))
      }
      if (props.glyph === 'reset') {
        return h(
          'svg',
          common,
          h('path', {
            d: 'M4 4h16v16H4z',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.8,
            opacity: 0.5,
          }),
          h('circle', { cx: 17, cy: 17, r: 3.2 }),
        )
      }
      if (props.glyph === 'arrow-left') return h('svg', common, h('path', { d: 'M21 11H11V6l-8 6 8 6v-5h10z' }))
      if (props.glyph === 'arrow-right') return h('svg', common, h('path', { d: 'M3 11h10V6l8 6-8 6v-5H3z' }))
      if (props.glyph === 'gear') {
        const teeth = []
        for (let index = 0; index < 8; index += 1) {
          teeth.push(
            h('rect', {
              key: index,
              x: 10.5,
              y: 1.4,
              width: 3,
              height: 4.4,
              rx: 1,
              transform: `rotate(${index * 45} 12 12)`,
            }),
          )
        }
        return h(
          'svg',
          common,
          teeth,
          h('circle', { cx: 12, cy: 12, r: 5.5, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2 }),
        )
      }
      if (props.glyph === 'volume') {
        return h(
          'svg',
          common,
          h('path', { d: 'M4 9h3l4-3v12l-4-3H4z' }),
          h('path', {
            d: 'M15 8.6a5 5 0 0 1 0 6.8',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.7,
            strokeLinecap: 'round',
          }),
        )
      }
      if (props.glyph === 'volume-mute') {
        return h(
          'svg',
          common,
          h('path', { d: 'M4 9h3l4-3v12l-4-3H4z' }),
          h('path', {
            d: 'M15 9l5 6M20 9l-5 6',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.7,
            strokeLinecap: 'round',
          }),
        )
      }
      if (props.glyph === 'collapse') return h('svg', common, h('path', { d: 'M6 10.5l6 6 6-6-1.4-1.4L12 13.7l-4.6-4.6z' }))
      return h('svg', common, h('path', { d: 'M6 13.5l6-6 6 6-1.4 1.4L12 10.3l-4.6 4.6z' }))
    }

    function Disc(props) {
      const track = props.track
      const meta = props.meta || SERVICES.other
      const key = track && track.coverKey
      const [broken, setBroken] = React.useState(false)

      React.useEffect(() => {
        setBroken(false)
      }, [key])

      const className = props.large ? 'mdk-disc mdk-disc-lg' : props.small ? 'mdk-disc mdk-disc-sm' : 'mdk-disc'

      if (key && !broken) {
        return h('img', {
          className: `${className} mdk-disc-img`,
          src: `/music-deck/cover?k=${encodeURIComponent(key)}`,
          alt: '',
          draggable: false,
          onError: () => setBroken(true),
        })
      }
      return h('div', { className, style: coverStyle(track) }, meta.badge)
    }

    function useSnapshot() {
      const [snapshot, setSnapshot] = React.useState(null)

      React.useEffect(() => {
        let alive = true
        let timer = null

        async function pull() {
          try {
            const response = await fetch('/music-deck/state', { cache: 'no-store' })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const data = await response.json()
            if (alive) setSnapshot(data)
          } catch (error) {
            if (alive) setSnapshot({ ok: false, reason: String((error && error.message) || error) })
          }
        }

        pull()
        timer = setInterval(() => {
          if (!document.hidden) pull()
        }, 1200)

        const onVisible = () => {
          if (!document.hidden) pull()
        }
        document.addEventListener('visibilitychange', onVisible)

        return () => {
          alive = false
          if (timer !== null) clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisible)
        }
      }, [])

      return [snapshot, setSnapshot]
    }

    function SettingRow(props) {
      return h(
        'div',
        { className: 'mdk-set-row' },
        h('span', { className: 'mdk-set-label' }, props.label),
        h(
          'button',
          {
            className: 'mdk-switch',
            type: 'button',
            role: 'switch',
            'aria-checked': props.checked ? 'true' : 'false',
            'aria-label': props.label,
            onClick: props.onToggle,
          },
          h('span', { className: 'mdk-switch-thumb' }),
        ),
      )
    }

    function VolumeSlider(props) {
      const trackRef = React.useRef(null)
      const [dragging, setDragging] = React.useState(false)
      const [hover, setHover] = React.useState(false)
      const percent = Math.round(clampNumber(props.value, 0, 1) * 100)

      function valueAt(event) {
        const node = trackRef.current
        if (!node) return props.value
        const box = node.getBoundingClientRect()
        if (box.width <= 0) return props.value
        return clampNumber((event.clientX - box.left) / box.width, 0, 1)
      }

      return h(
        'div',
        {
          className: 'mdk-vol',
          role: 'slider',
          tabIndex: 0,
          'aria-label': props.label,
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuenow': percent,
          onPointerDown: (event) => {
            if (event.button !== 0) return
            event.preventDefault()
            setDragging(true)
            try {
              event.currentTarget.setPointerCapture(event.pointerId)
            } catch {
              /* capture is optional */
            }
            props.onChange(valueAt(event))
          },
          onPointerMove: (event) => {
            if (!dragging) return
            props.onChange(valueAt(event))
          },
          onPointerUp: (event) => {
            setDragging(false)
            try {
              event.currentTarget.releasePointerCapture(event.pointerId)
            } catch {
              /* already released */
            }
          },
          onPointerCancel: () => setDragging(false),
          onPointerEnter: () => setHover(true),
          onPointerLeave: () => setHover(false),
        },
        hover || dragging
          ? h('span', { className: 'mdk-vol-bubble', style: { left: `${percent}%` } }, `${percent}%`)
          : null,
        h(
          'div',
          { className: 'mdk-vol-track', ref: trackRef },
          h('div', { className: 'mdk-vol-fill', style: { width: `${percent}%` } }),
        ),
        h('span', { className: 'mdk-vol-thumb', style: { left: `${percent}%` } }),
      )
    }

    function Player(props) {
      const t = props.t
      const [snapshot, setSnapshot] = useSnapshot()
      const [expanded, setExpanded] = React.useState(() => {
        try {
          return localStorage.getItem('music-deck.expanded') !== '0'
        } catch {
          return true
        }
      })
      const [picked, setPicked] = React.useState(null)
      const [placement, setPlacement] = React.useState(() => readPlacement())
      const [viewport, setViewport] = React.useState(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }))
      const [leftInset, setLeftInset] = React.useState(() =>
        leftInsetFor({ width: window.innerWidth, height: window.innerHeight }),
      )
      const [size, setSize] = React.useState(() =>
        expanded
          ? isCompactViewport(viewport)
            ? { width: 140, height: 76 }
            : { width: 288, height: 150 }
          : { width: 98, height: 56 },
      )
      const [dragPos, setDragPos] = React.useState(null)
      const [pop, setPop] = React.useState(null)
      const [settings, setSettings] = React.useState(() => readSettings())
      const [hidden, setHidden] = React.useState(false)
      const [menu, setMenu] = React.useState(null)
      const menuRef = React.useRef(null)
      const [volumeDraft, setVolumeDraft] = React.useState(null)
      const [mutedDraft, setMutedDraft] = React.useState(null)
      const volumeTouchedAt = React.useRef(0)
      const muteTouchedAt = React.useRef(0)
      const dragPosRef = React.useRef(null)
      const rootRef = React.useRef(null)
      const dragRef = React.useRef(null)
      const movedRef = React.useRef(false)

      React.useEffect(() => {
        const node = rootRef.current
        if (!node) return undefined
        const measure = () => setSize({ width: node.offsetWidth, height: node.offsetHeight })
        measure()
        if (typeof ResizeObserver === 'function') {
          const observer = new ResizeObserver(measure)
          observer.observe(node)
          return () => observer.disconnect()
        }
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
      }, [])

      React.useEffect(() => {
        const onResize = () => {
          const next = { width: window.innerWidth, height: window.innerHeight }
          setViewport(next)
          setLeftInset(leftInsetFor(next))
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      }, [])

      function onPointerDown(event) {
        if (event.button !== 0) return
        const target = event.target
        if (
          target &&
          typeof target.closest === 'function' &&
          target.closest('button, input, a, select, textarea, .mdk-progress, .mdk-pop, .mdk-menu, form')
        ) {
          return
        }
        const root = rootRef.current
        if (!root) return
        const box = root.getBoundingClientRect()
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originY: box.top,
          side: box.left + box.width / 2 < window.innerWidth / 2 ? 'left' : 'right',
          captured: false,
        }
        movedRef.current = false
        // Capture is deferred to the first real movement: capturing on pointerdown
        // retargets the following click to this element, which would swallow a tap
        // on the collapsed pill.
      }

      function onPointerMove(event) {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const dx = event.clientX - drag.startX
        const dy = event.clientY - drag.startY
        if (!movedRef.current && Math.abs(dx) + Math.abs(dy) < 4) return
        movedRef.current = true

        if (!drag.captured) {
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.captured = true
          } catch {
            /* capture is optional */
          }
        }

        // Horizontal movement picks a side gutter; the card never rests over the text column.
        drag.side = sideForPointer(event.clientX, viewport)
        const left =
          drag.side === 'left'
            ? leftInset
            : Math.max(DECK_MARGIN, viewport.width - size.width - DECK_MARGIN)
        const limit = Math.max(DECK_MARGIN, viewport.height - size.height - DECK_MARGIN)
        const next = { left, top: clampNumber(drag.originY + dy, DECK_MARGIN, limit) }
        dragPosRef.current = next
        setDragPos(next)
      }

      function onPointerUp(event) {
        const drag = dragRef.current
        if (!drag) return
        dragRef.current = null
        if (drag.captured) {
          try {
            event.currentTarget.releasePointerCapture(drag.pointerId)
          } catch {
            /* already released */
          }
        }
        if (!movedRef.current) return
        const current = dragPosRef.current
        dragPosRef.current = null
        if (!current) {
          setDragPos(null)
          return
        }
        const travel = Math.max(0, viewport.height - size.height - DECK_MARGIN * 2)
        const next = {
          side: drag.side,
          yRatio: travel > 0 ? clampNumber((current.top - DECK_MARGIN) / travel, 0, 1) : 0,
        }
        setPlacement(next)
        savePlacement(next)
        setDragPos(null)
        // The click that follows this pointerup belongs to the drag, not to the pill.
        setTimeout(() => {
          movedRef.current = false
        }, 0)
      }

      function flipSide() {
        // Re-measure now: the left column may have been collapsed since load.
        setLeftInset(leftInsetFor(viewport))
        const next = {
          side: activePlacement.side === 'left' ? 'right' : 'left',
          yRatio: activePlacement.yRatio,
        }
        setPlacement(next)
        savePlacement(next)
      }

      function resetPlacement() {
        setPlacement(null)
        setDragPos(null)
        try {
          localStorage.removeItem('music-deck.placement')
          localStorage.removeItem('music-deck.anchor')
        } catch {
          /* storage may be unavailable */
        }
      }

      const activePlacement = placement || DEFAULT_PLACEMENT

      // The left column can be collapsed or resized without a window resize.
      React.useEffect(() => {
        if (activePlacement.side !== 'left') return undefined
        const id = setInterval(() => {
          setLeftInset(leftInsetFor({ width: window.innerWidth, height: window.innerHeight }))
        }, 2000)
        return () => clearInterval(id)
      }, [activePlacement.side])

      const resolved = dragPos || resolvePlacement(activePlacement, size, viewport, leftInset)
      const rootProps = {
        className: 'mdk-root',
        ref: rootRef,
        'data-snap': dragPos ? '0' : '1',
        'data-opaque': settings.opaque ? '1' : '0',
        style: {
          left: `${Math.round(resolved.left)}px`,
          top: `${Math.round(resolved.top)}px`,
          right: 'auto',
          bottom: 'auto',
        },
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
        onContextMenu: (event) => {
          event.preventDefault()
          closePop()
          setMenu({
            x: Math.min(event.clientX, window.innerWidth - 140),
            y: Math.min(event.clientY, window.innerHeight - 40),
          })
        },
      }

      // Popovers open downwards; flip above only when the card sits too low.
      const spaceBelow = viewport.height - (resolved.top + size.height)
      const popStyle = spaceBelow >= 120 ? { top: 'calc(100% + 6px)' } : { bottom: 'calc(100% + 6px)' }

      const [, forceLocale] = React.useState(0)
      React.useEffect(() => {
        if (!props.locale || typeof props.locale.subscribe !== 'function') return undefined
        return props.locale.subscribe(() => forceLocale((value) => value + 1))
      }, [props.locale])

      const sessions = (snapshot && Array.isArray(snapshot.sessions)) ? snapshot.sessions : []
      const active =
        (picked ? sessions.find((session) => session.id === picked) : null) ||
        // Prefer the app that is actually sounding: Windows' "current" session
        // can stay on a paused player, which would point the volume at the
        // wrong app.
        sessions.find((session) => session.isCurrent && session.status === 'playing') ||
        sessions.find((session) => session.status === 'playing') ||
        sessions.find((session) => session.isCurrent) ||
        sessions[0] ||
        null

      const service = serviceOf(active && active.id)
      const meta = SERVICES[service] || SERVICES.other
      const playing = Boolean(active && active.status === 'playing')
      const duration = active && active.duration > 0 ? active.duration : 0
      const rawVolume =
        active && typeof active.volume === 'number' && active.volume >= 0 ? active.volume : null
      // A local edit wins only briefly; after that the polled value takes over so
      // changes made inside the music app show up here too.
      const draftFresh = volumeDraft !== null && Date.now() - volumeTouchedAt.current < 1500
      const level = draftFresh ? volumeDraft : rawVolume === null ? 0 : rawVolume
      const mutedFresh = mutedDraft !== null && Date.now() - muteTouchedAt.current < 1500
      const muted = mutedFresh ? mutedDraft : Boolean(active && active.muted === 1)
      const position = active ? Math.min(active.position || 0, duration || active.position || 0) : 0
      const ratio = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0

      function setExpandedPersist(next) {
        setExpanded(next)
        try {
          localStorage.setItem('music-deck.expanded', next ? '1' : '0')
        } catch {
          /* ignore */
        }
      }

      function patchStatus(nextStatus) {
        setSnapshot((current) => {
          if (!current || !Array.isArray(current.sessions)) return current
          return {
            ...current,
            sessions: current.sessions.map((session) =>
              session.id === active.id ? { ...session, status: nextStatus } : session,
            ),
          }
        })
      }

      async function command(action, extra) {
        if (!active) return
        if (action === 'toggle') patchStatus(playing ? 'paused' : 'playing')
        try {
          await fetch('/music-deck/cmd', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action, app: active.id, exclusive: settings.exclusive, ...(extra || {}) }),
          })
        } catch (error) {
          /* the next poll restores the authoritative state */
        }
      }

      function cycleSession() {
        if (sessions.length < 2) return
        const index = sessions.findIndex((session) => session.id === active.id)
        const next = sessions[(index + 1) % sessions.length]
        setPicked(next.id)
      }

      function seek(event) {
        if (!active || duration <= 0) return
        const box = event.currentTarget.getBoundingClientRect()
        const ratioNext = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width))
        command('seek', { position: Math.round(ratioNext * duration) })
      }

      function post(body) {
        fetch('/music-deck/cmd', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }).catch(() => {
          /* the next poll reconciles */
        })
      }

      function updateSetting(key, value) {
        setSettings((current) => {
          const next = { ...current, [key]: value }
          saveSettings(next)
          return next
        })
      }

      function closePop() {
        setPop(null)
        setVolumeDraft(null)
        setMutedDraft(null)
      }

      function togglePop(next) {
        if (pop === next) {
          closePop()
          return
        }
        setVolumeDraft(null)
        setMutedDraft(null)
        setPop(next)
      }

      function changeVolume(next) {
        const clamped = Math.max(0, Math.min(1, next))
        volumeTouchedAt.current = Date.now()
        setVolumeDraft(clamped)
        post({ action: 'volume', level: clamped, app: active ? active.id : undefined })
      }

      function toggleMute() {
        const next = !muted
        muteTouchedAt.current = Date.now()
        setMutedDraft(next)
        post({ action: 'mute', muted: next, app: active ? active.id : undefined })
      }

      React.useEffect(() => {
        if (pop === null) return undefined
        const onDown = (event) => {
          const root = rootRef.current
          if (root && root.contains(event.target)) return
          closePop()
        }
        document.addEventListener('pointerdown', onDown, true)
        return () => document.removeEventListener('pointerdown', onDown, true)
      }, [pop])

      React.useEffect(() => {
        if (menu === null) return undefined
        const onDown = (event) => {
          const node = menuRef.current
          if (node && node.contains(event.target)) return
          setMenu(null)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') setMenu(null)
        }
        document.addEventListener('pointerdown', onDown, true)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('pointerdown', onDown, true)
          document.removeEventListener('keydown', onKey)
        }
      }, [menu])

      const stale = snapshot && snapshot.agent && snapshot.agent !== 'live'

      const menuNode =
        menu === null
          ? null
          : h(
              'div',
              {
                className: 'mdk-menu',
                style: { left: `${menu.x}px`, top: `${menu.y}px` },
                ref: menuRef,
              },
              h(
                'button',
                {
                  className: 'mdk-menu-item',
                  type: 'button',
                  onClick: () => {
                    setMenu(null)
                    setHidden(true)
                  },
                },
                t('menuHide'),
              ),
            )

      if (hidden) {
        // Hidden by right-click: a dot keeps the way back.
        return h(
          'div',
          rootProps,
          h(
            'button',
            {
              className: 'mdk-restore',
              type: 'button',
              title: t('restore'),
              'aria-label': t('restore'),
              onClick: () => setHidden(false),
              onPointerDown: (event) => event.stopPropagation(),
            },
            h('span', { className: 'mdk-restore-dot' }),
          ),
        )
      }

      if (!expanded) {
        const miniTitle = active
          ? `${active.title || t('unknownTrack')} — ${active.artist || t('unknownArtist')}`
          : t('expand')
        return h(
          'div',
          rootProps,
          h(
            'div',
            {
              className: 'mdk-mini',
              role: 'button',
              tabIndex: 0,
              title: miniTitle,
              onClick: () => {
                if (movedRef.current) {
                  movedRef.current = false
                  return
                }
                setExpandedPersist(true)
              },
              // Belt and braces: expand on release too, in case a tap never
              // arrives as a click (pointer capture, gesture cancellation).
              onPointerUp: (event) => {
                if (movedRef.current) return
                const target = event.target
                if (target && typeof target.closest === 'function' && target.closest('button')) return
                setExpandedPersist(true)
              },
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setExpandedPersist(true)
                }
              },
            },
            h(Disc, { track: active, meta }),
            h(
              'button',
              {
                className: 'mdk-play mdk-mini-play',
                type: 'button',
                title: playing ? t('pause') : t('play'),
                'aria-label': playing ? t('pause') : t('play'),
                disabled: !active,
                onClick: (event) => {
                  event.stopPropagation()
                  command('toggle')
                },
              },
              h(Icon, { glyph: playing ? 'pause' : 'play', size: 15 }),
            ),
          ),
          menuNode,
        )
      }

      const compact = settings.autoCompact && isCompactViewport(viewport)

      if (compact) {
        // Windowed layout: the source sits on its own row, artwork and transport below.
        return h(
          'div',
          rootProps,
          h(
            'div',
            { className: 'mdk-card mdk-compact' },
            h(
              'div',
              { className: 'mdk-compact-top' },
              h(
                'button',
                {
                  className: 'mdk-source',
                  type: 'button',
                  title:
                    sessions.length > 1
                      ? t('switchSource')
                      : active
                        ? `${active.title || t('unknownTrack')} — ${active.artist || t('unknownArtist')}`
                        : meta.label,
                  onClick: cycleSession,
                },
                h('span', { className: 'mdk-dot', style: { background: meta.color } }),
                h('span', { className: 'mdk-src-label' }, active ? meta.label : t('noSource')),
              ),
              h('span', { className: 'mdk-spacer' }),
              h(
                'button',
                {
                  className: 'mdk-icon',
                  type: 'button',
                  title: activePlacement.side === 'left' ? t('moveRight') : t('moveLeft'),
                  'aria-label': activePlacement.side === 'left' ? t('moveRight') : t('moveLeft'),
                  onClick: flipSide,
                },
                h(Icon, { glyph: activePlacement.side === 'left' ? 'arrow-right' : 'arrow-left', size: 13 }),
              ),
              h(
                'button',
                {
                  className: 'mdk-icon',
                  type: 'button',
                  title: t('collapse'),
                  'aria-label': t('collapse'),
                  onClick: () => setExpandedPersist(false),
                },
                h(Icon, { glyph: 'collapse', size: 13 }),
              ),
            ),
            h(
              'div',
              { className: 'mdk-compact-bottom' },
              h(Disc, { track: active, meta, small: true }),
              h(
                'button',
                {
                  className: 'mdk-icon',
                  type: 'button',
                  title: t('prev'),
                  'aria-label': t('prev'),
                  disabled: !active,
                  onClick: () => command('prev'),
                },
                h(Icon, { glyph: 'prev', size: 14 }),
              ),
              h(
                'button',
                {
                  className: 'mdk-play',
                  type: 'button',
                  title: playing ? t('pause') : t('play'),
                  'aria-label': playing ? t('pause') : t('play'),
                  disabled: !active,
                  onClick: () => command('toggle'),
                },
                h(Icon, { glyph: playing ? 'pause' : 'play', size: 15 }),
              ),
              h(
                'button',
                {
                  className: 'mdk-icon',
                  type: 'button',
                  title: t('next'),
                  'aria-label': t('next'),
                  disabled: !active,
                  onClick: () => command('next'),
                },
                h(Icon, { glyph: 'next', size: 14 }),
              ),
            ),
          ),
          menuNode,
        )
      }

      return h(
        'div',
        rootProps,
        h(
          'div',
          { className: 'mdk-card' },
          h(
            'div',
            { className: 'mdk-head' },
            h(
              'button',
              {
                className: 'mdk-source',
                type: 'button',
                title: sessions.length > 1 ? t('switchSource') : meta.label,
                onClick: cycleSession,
              },
              h('span', { className: 'mdk-dot', style: { background: meta.color } }),
              h('span', { className: 'mdk-src-label' }, active ? meta.label : t('noSource')),
            ),
            h('span', { className: 'mdk-spacer' }),
            h(
              'button',
              {
                className: 'mdk-icon',
                type: 'button',
                title: activePlacement.side === 'left' ? t('moveRight') : t('moveLeft'),
                'aria-label': activePlacement.side === 'left' ? t('moveRight') : t('moveLeft'),
                onClick: flipSide,
              },
              h(Icon, { glyph: activePlacement.side === 'left' ? 'arrow-right' : 'arrow-left' }),
            ),
            placement
              ? h(
                  'button',
                  {
                    className: 'mdk-icon',
                    type: 'button',
                    title: t('resetAnchor'),
                    'aria-label': t('resetAnchor'),
                    onClick: resetPlacement,
                  },
                  h(Icon, { glyph: 'reset' }),
                )
              : null,
            h(
              'button',
              {
                className: 'mdk-icon',
                type: 'button',
                title: t('collapse'),
                'aria-label': t('collapse'),
                onClick: () => setExpandedPersist(false),
              },
              h(Icon, { glyph: 'collapse' }),
            ),
          ),

          active
            ? h(
                'div',
                { className: 'mdk-body' },
                h(Disc, { track: active, meta, large: true }),
                h(
                  'div',
                  { className: 'mdk-meta' },
                  h('div', { className: 'mdk-meta-title', title: active.title }, active.title || t('unknownTrack')),
                  h(
                    'div',
                    { className: 'mdk-meta-sub', title: active.artist },
                    active.artist || t('unknownArtist'),
                  ),
                  active.album ? h('div', { className: 'mdk-meta-album' }, active.album) : null,
                ),
              )
            : h(
                'div',
                { className: 'mdk-empty' },
                h('div', { className: 'mdk-empty-title' }, t('idle')),
                h('div', { className: 'mdk-empty-hint' }, t('idleHint')),
              ),

          duration > 0
            ? h(
                'div',
                { className: 'mdk-progress', onClick: seek, role: 'presentation' },
                h('div', { className: 'mdk-track' }, h('div', { className: 'mdk-fill', style: { width: `${ratio * 100}%` } })),
              )
            : null,

          h(
            'div',
            { className: 'mdk-controls' },
            h(
              'button',
              {
                className: 'mdk-icon',
                type: 'button',
                title: t('prev'),
                'aria-label': t('prev'),
                disabled: !active,
                onClick: () => command('prev'),
              },
              h(Icon, { glyph: 'prev' }),
            ),
            h(
              'button',
              {
                className: 'mdk-play',
                type: 'button',
                title: playing ? t('pause') : t('play'),
                'aria-label': playing ? t('pause') : t('play'),
                disabled: !active,
                onClick: () => command('toggle'),
              },
              h(Icon, { glyph: playing ? 'pause' : 'play', size: 17 }),
            ),
            h(
              'button',
              {
                className: 'mdk-icon',
                type: 'button',
                title: t('next'),
                'aria-label': t('next'),
                disabled: !active,
                onClick: () => command('next'),
              },
              h(Icon, { glyph: 'next' }),
            ),
            h(
              'div',
              { className: 'mdk-right' },
              duration > 0 ? h('span', { className: 'mdk-time' }, `${clock(position)} / ${clock(duration)}`) : null,
              h(
                'button',
                {
                  className: 'mdk-icon',
                  type: 'button',
                  title: t('settings'),
                  'aria-label': t('settings'),
                  onClick: () => togglePop('settings'),
                },
                h(Icon, { glyph: 'gear', size: 10 }),
              ),
              h(
                'button',
                {
                  className: 'mdk-icon',
                  type: 'button',
                  title: muted ? t('unmute') : t('volume'),
                  'aria-label': t('volume'),
                  onClick: () => togglePop('volume'),
                },
                h(Icon, { glyph: muted ? 'volume-mute' : 'volume' }),
              ),
            ),
          ),

          stale ? h('div', { className: 'mdk-note' }, t('agentStale')) : null,
        ),

        pop === 'settings'
          ? h(
              'div',
              { className: 'mdk-pop', style: popStyle },
              h('div', { className: 'mdk-pop-title' }, h('span', null, t('settings'))),
              h(SettingRow, {
                label: t('settingsOpaque'),
                checked: settings.opaque,
                onToggle: () => updateSetting('opaque', !settings.opaque),
              }),
              h(SettingRow, {
                label: t('settingsCompact'),
                checked: settings.autoCompact,
                onToggle: () => updateSetting('autoCompact', !settings.autoCompact),
              }),
              h(SettingRow, {
                label: t('settingsExclusive'),
                checked: settings.exclusive,
                onToggle: () => updateSetting('exclusive', !settings.exclusive),
              }),
            )
          : null,

        pop === 'volume'
          ? h(
              'div',
              { className: 'mdk-pop', style: popStyle },
              h(
                'div',
                { className: 'mdk-vol-row' },
                h(
                  'button',
                  {
                    className: 'mdk-icon',
                    type: 'button',
                    title: muted ? t('unmute') : t('mute'),
                    'aria-label': muted ? t('unmute') : t('mute'),
                    disabled: !active,
                    onClick: toggleMute,
                  },
                  h(Icon, { glyph: muted ? 'volume-mute' : 'volume' }),
                ),
                h(VolumeSlider, { value: level, onChange: changeVolume, label: t('volume') }),
              ),
            )
          : null,

        menuNode,
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(
          () =>
            ctx.locale.register(NS, 'zh', {
              idle: '没有正在播放的音乐',
              idleHint: '在 QQ音乐、网易云音乐或 Spotify 里播放后会自动出现',
              idleHintShort: '等待播放',
              play: '播放',
              pause: '暂停',
              next: '下一首',
              prev: '上一首',
              collapse: '收起',
              expand: '展开播放器',
              resetAnchor: '回到右下角',
              moveLeft: '移到左侧',
              moveRight: '移到右侧',
              switchSource: '切换播放来源',
              noSource: '未检测到播放器',
              unknownTrack: '未知曲目',
              unknownArtist: '未知艺术家',
              playing: '播放中',
              paused: '已暂停',
              settings: '设置',
              volume: '音量',
              mute: '静音',
              unmute: '取消静音',
              noSettings: '暂无设置项',
              settingsOpaque: '卡片不透明',
              settingsCompact: '窗口化时自动缩小',
              settingsExclusive: '切换音源时自动暂停',
              menuHide: '隐藏卡片',
              restore: '显示播放器',
              agentStale: '媒体会话服务未就绪，正在重试…',
            }),
          'music-deck: zh dictionary',
        )

        ctx.effect(
          () =>
            ctx.locale.register(NS, 'en', {
              idle: 'Nothing is playing',
              idleHint: 'Start a track in QQ Music, NetEase Cloud Music or Spotify and it appears here',
              idleHintShort: 'waiting for playback',
              play: 'Play',
              pause: 'Pause',
              next: 'Next track',
              prev: 'Previous track',
              collapse: 'Collapse',
              expand: 'Expand player',
              resetAnchor: 'Reset position',
              moveLeft: 'Move to the left',
              moveRight: 'Move to the right',
              switchSource: 'Switch playback source',
              noSource: 'No player detected',
              unknownTrack: 'Unknown track',
              unknownArtist: 'Unknown artist',
              playing: 'Playing',
              paused: 'Paused',
              settings: 'Settings',
              volume: 'Volume',
              mute: 'Mute',
              unmute: 'Unmute',
              noSettings: 'No settings yet',
              settingsOpaque: 'Opaque card',
              settingsCompact: 'Shrink when windowed',
              settingsExclusive: 'Pause when switching sources',
              restore: 'Show player',
              menuHide: 'Hide card',
              agentStale: 'Media session agent is not ready, retrying…',
            }),
          'music-deck: en dictionary',
        )

        const t = ctx.locale.bind(NS)

        ctx.effect(() => {
          const style = document.createElement('style')
          style.id = STYLE_ID
          style.textContent = CSS
          document.head.appendChild(style)
          return () => {
            style.remove()
          }
        }, 'music-deck: styles')

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'music-deck.player',
              order: 40,
              label: 'Music deck',
            },
            (slotProps) => h(Player, { ...slotProps, t, locale: ctx.locale }),
          ),
        )
      },
    }
  },
})