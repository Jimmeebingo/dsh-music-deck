import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Pull the pure right-panel helper straight out of the shipped client, the same
// way the selection test does, so this test cannot drift from the real code.
const here = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(path.join(here, '..', 'client.js'), 'utf8')
const start = source.indexOf('const RIGHT_PANEL_MIN')
const end = source.indexOf('function Icon(')
if (start < 0 || end < 0) throw new Error('right panel helpers not found in client.js')
const { rightPanelInset, measureRightPanelInset } = new Function(
  `${source.slice(start, end)}; return { rightPanelInset, measureRightPanelInset }`,
)()

const cases = []
const check = (name, actual, expected) => {
  cases.push({ name, ok: actual === expected, actual, expected })
}

const viewport = { width: 1600, height: 900 }
const box = (left, right, height) => ({
  left,
  right,
  width: right - left,
  height: height === undefined ? 900 : height,
})

// The reported problem: DSH's file viewer takes the right side, the text column
// is squeezed and slides under the card, so the deck has to shrink.
check('file viewer on the right', rightPanelInset([box(1180, 1600)], viewport), 420)
check('a page with no panel', rightPanelInset([box(0, 1600)], viewport), 0)
check('an empty page', rightPanelInset([], viewport), 0)
check('a panel that is not flush with the right edge', rightPanelInset([box(1180, 1560)], viewport), 0)
check('a scrollbar-sized sliver is not a panel', rightPanelInset([box(1588, 1600)], viewport), 0)
check('a short right-hand box is not a panel', rightPanelInset([box(1180, 1600, 300)], viewport), 0)
check('the deck card itself is not a panel', rightPanelInset([box(1290, 1584, 150)], viewport), 0)
check('a half-page-wide box is the shell, not a panel', rightPanelInset([box(700, 1600)], viewport), 0)
check('a left-docked box is not a panel', rightPanelInset([box(0, 300)], viewport), 0)
check('the widest box wins over its inner content', rightPanelInset([box(1180, 1600), box(1200, 1580)], viewport), 420)
check('a smaller window still measures', rightPanelInset([box(520, 900)], { width: 900, height: 600 }), 380)
check('a panel wider than half of a small window is refused', rightPanelInset([box(400, 900)], { width: 900, height: 600 }), 0)
check('a panel below the minimum width is refused', rightPanelInset([box(1450, 1600)], viewport), 0)

// The geometry above is pure; these use a fake page to cover the traversal too,
// including the rule that the deck's own card is never read as a panel.
function el(rect, children = []) {
  const node = {
    children,
    getBoundingClientRect: () => rect,
    contains(other) {
      if (other === node) return true
      return children.some((child) => child.contains(other))
    },
  }
  return node
}

const fullPage = { left: 0, right: 1600, width: 1600, height: 900 }
const cardBox = { left: 1290, right: 1584, width: 294, height: 150 }

// No panel: a full-size shell with the deck's overlay host inside it.
{
  const card = el(cardBox)
  globalThis.document = { body: el(fullPage, [el(fullPage, [el(fullPage, [card])])]) }
  check('live page without a panel', measureRightPanelInset(viewport, card), 0)
}

// The file viewer opens beside the shell: the card is ignored, the panel is found.
{
  const card = el(cardBox)
  const panel = el({ left: 1180, right: 1600, width: 420, height: 900 })
  globalThis.document = { body: el(fullPage, [el(fullPage, [el(fullPage, [card])]), panel]) }
  check('live page with the file viewer open', measureRightPanelInset(viewport, card), 420)
}

// A card that is itself right-flush and taller than half a short window.
{
  const card = el({ left: 1300, right: 1592, width: 292, height: 560 })
  globalThis.document = { body: el(fullPage, [el(fullPage, [card])]) }
  check('a tall card is not read as a panel', measureRightPanelInset({ width: 1600, height: 600 }, card), 0)
}

// Nothing to measure yet (mounting before the shell exists) must not throw.
{
  globalThis.document = { body: null }
  check('a page without a body', measureRightPanelInset(viewport, null), 0)
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  const actual = JSON.stringify(item.actual)
  console.log(`${item.ok ? 'ok  ' : 'FAIL'}  ${item.name} -> ${actual}${item.ok ? '' : ` (expected ${JSON.stringify(item.expected)})`}`)
}
console.log(failed === 0 ? `\nall ${cases.length} checks passed` : `\n${failed} of ${cases.length} failed`)
process.exitCode = failed === 0 ? 0 : 1