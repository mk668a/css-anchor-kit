import { useState } from 'react'
import { SafeArea, Tooltip, TooltipContent, TooltipTrigger } from 'css-anchor-kit'

/**
 * Live preview: the hover corridor.
 *
 * Two identical hover cards sat over a wide `offset` gap. The first closes the
 * moment the pointer leaves its trigger — the gap belongs to neither element.
 * The second adds `safeArea` + `<SafeArea />`: a transparent rect the browser
 * positions between the two boxes, so the trip across counts as "still here".
 */
function Row({ safe, visible }: { safe: boolean; visible: boolean }) {
  return (
    <div className="safe-area-row">
      <span className="safe-area-label">
        <code>safeArea</code> {safe ? 'on' : 'off'}
      </span>

      <Tooltip placement="right" offset={28} openDelay={0} safeArea={safe}>
        <TooltipTrigger className="btn">
          {safe ? 'Hover, then walk over' : 'Hover, then try to reach the card'}
        </TooltipTrigger>
        <TooltipContent className="card hover-card" role="note">
          {safe && <SafeArea className={visible ? 'safe-area is-visible' : 'safe-area'} />}
          <strong>{safe ? 'Made it.' : 'Gone before you arrive.'}</strong>
          <span>
            {safe
              ? 'The corridor between the two boxes is hoverable, so crossing it never counts as leaving.'
              : 'The gap belongs to neither element, so the pointer lands on nothing and the card closes.'}
          </span>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export function SafeAreaDemo() {
  const [visible, setVisible] = useState(false)

  return (
    <div className="preview">
      <div className="safe-area-bar">
        <label className="check">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
          />
          Paint the corridor
        </label>
        <span className="safe-area-hint">
          Hover a trigger, then move diagonally toward its card.
        </span>
      </div>

      <div className="safe-area-stage">
        <Row safe={false} visible={visible} />
        <Row safe visible={visible} />
      </div>
    </div>
  )
}
