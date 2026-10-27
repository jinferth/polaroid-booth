import { useCallback, useEffect, useRef, useState } from 'react'

import { CAMERA_BODIES, getBody, type CameraBody } from '../lib/bodies'
import { SIMULATIONS } from '../lib/fuji'

interface BodyShelfProps {
  /** Currently selected body id. */
  selectedId: string
  /** Called when the user picks a body. */
  onSelect: (body: CameraBody) => void
}

/**
 * The camera-shop counter.
 *
 * A row of bodies sitting on a wooden shelf, the way they'd be displayed in a
 * shop. Pick one and the camera on the left becomes it.
 *
 * Each tile renders a *miniature* of the body — a few gradients at thumbnail
 * scale — rather than a full camera. Rendering eight full shells at once would
 * cost far too much paint on a low-end machine.
 */
export function BodyShelf({ selectedId, onSelect }: BodyShelfProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 8)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }, [])

  useEffect(() => {
    updateArrows()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows])

  const scrollBy = (dir: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' })
  }

  return (
    <section className="mx-auto mt-8 w-full max-w-4xl">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            机身陈列 · CAMERA BODIES
          </h3>
          <p className="mt-1 text-xs text-ink-soft">
            <span className="font-medium text-ink">{getBody(selectedId).name}</span>
            <span className="mx-1.5 text-ink-faint">·</span>
            {getBody(selectedId).blurb}
          </p>
        </div>

        <div className="hidden shrink-0 gap-1.5 sm:flex">
          <button
            type="button"
            className="icon-btn !h-8 !w-8 disabled:opacity-30"
            onClick={() => scrollBy(-1)}
            disabled={!canScrollLeft}
            aria-label="向左浏览机身"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn !h-8 !w-8 disabled:opacity-30"
            onClick={() => scrollBy(1)}
            disabled={!canScrollRight}
            aria-label="向右浏览机身"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* The counter: a wooden shelf the bodies stand on. */}
      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto px-1 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {CAMERA_BODIES.map((body) => {
            const selected = body.id === selectedId
            return (
              <button
                key={body.id}
                type="button"
                onClick={() => onSelect(body)}
                aria-pressed={selected}
                title={`${body.name} — ${body.blurb}`}
                className={`group relative flex w-[104px] shrink-0 flex-col items-center gap-2 rounded-lg px-2 pb-2 pt-2.5 transition-all duration-200 ${
                  selected
                    ? 'bg-white shadow-[0_0_0_2px_var(--color-ink),0_4px_0_rgba(27,24,21,0.85)]'
                    : 'bg-paper/70 hover:-translate-y-1 hover:bg-white hover:shadow-[0_6px_16px_rgba(60,45,30,0.16)]'
                }`}
              >
                {/* --- Miniature body ------------------------------------ */}
                <BodyThumb body={body} />

                <span className="w-full truncate text-center text-[11px] font-medium text-ink">
                  {body.name}
                </span>

                {/* The simulation this body shoots with */}
                <span className="w-full truncate text-center font-mono text-[8px] uppercase tracking-[0.06em] text-ink-faint">
                  {SIMULATIONS.find((s) => s.id === body.defaultSim)?.name ?? body.defaultSim}
                </span>

                {/* Provenance: which real camera this is modelled on */}
                {body.lineage && (
                  <span className="w-full truncate text-center text-[7.5px] leading-tight text-ink-faint/70">
                    {body.lineage}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* The shelf plank */}
        <div
          aria-hidden="true"
          className="h-2 rounded-[2px] bg-gradient-to-b from-[#c9a678] to-[#a07f52] shadow-[0_3px_8px_rgba(90,66,40,0.28)]"
        />
      </div>
    </section>
  )
}

/**
 * A tiny CSS rendition of a camera body, built from the same colour tokens as
 * the real shell so the thumbnail always matches what you'll get.
 *
 * The silhouette differs per structural family — that's the whole point of
 * the shelf: you should be able to tell a Mini from an SX-70 at thumbnail size.
 */
function BodyThumb({ body }: { body: CameraBody }) {
  const c = body.colors
  const shape = body.shape

  // Per-family proportions.
  const geom = {
    rangefinder: { h: 34, r: '8px 8px 4px 4px', w: '80px', lens: 20, lensLeft: '10px', lensTop: '9px' },
    mini: { h: 42, r: '14px 14px 11px 11px', w: '64px', lens: 24, lensLeft: '7px', lensTop: '8px' },
    evo: { h: 36, r: '3px', w: '82px', lens: 22, lensLeft: '9px', lensTop: '7px' },
    sx70: { h: 26, r: '5px 5px 3px 3px', w: '88px', lens: 17, lensLeft: '16px', lensTop: '5px' },
    onestep: { h: 38, r: '3px', w: '76px', lens: 22, lensLeft: '27px', lensTop: '8px' },
    bubble: { h: 36, r: '12px 12px 9px 9px', w: '72px', lens: 21, lensLeft: '9px', lensTop: '8px' },
    boxy: { h: 36, r: '3px', w: '78px', lens: 20, lensLeft: '9px', lensTop: '8px' },
  }[shape]

  const isOneStep = shape === 'onestep'
  const isEvo = shape === 'evo'

  return (
    <span
      aria-hidden="true"
      className="relative block h-[54px] w-[92px]"
      style={{
        ['--fuji-silver-hi' as string]: c.plateHi,
        ['--fuji-silver' as string]: c.plate,
        ['--fuji-silver-lo' as string]: c.plateLo,
        ['--fuji-black' as string]: c.bodyHi,
        ['--fuji-leather' as string]: c.body,
        ['--fuji-black-lo' as string]: c.bodyLo,
        ['--fuji-red' as string]: c.accent,
        ['--fuji-ink' as string]: c.ink,
        ['--fuji-lens-rim' as string]: c.lensRim,
      }}
    >
      {/* Body slab */}
      <span
        className="absolute bottom-0 left-1/2 block -translate-x-1/2 overflow-hidden"
        style={{
          width: geom.w,
          height: `${geom.h}px`,
          borderRadius: geom.r,
          border: `1.5px solid ${c.ink}`,
          background:
            c.finish === 'transparent'
              ? `linear-gradient(160deg, ${c.plateHi} 0%, ${c.body} 60%, ${c.bodyLo} 100%)`
              : shape === 'sx70'
                ? `linear-gradient(180deg, ${c.plateHi} 0%, ${c.plate} 14%, ${c.plateLo} 20%, ${c.body} 21%, ${c.bodyLo} 100%)`
                : `linear-gradient(180deg, ${c.plateHi} 0%, ${c.plate} 30%, ${c.plateLo} 34%, ${c.body} 35%, ${c.bodyLo} 100%)`,
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.45)',
        }}
      >
        {/* OneStep rainbow stripe */}
        {isOneStep && (
          <span
            className="absolute inset-x-0"
            style={{
              top: '44%',
              height: '7px',
              background:
                'linear-gradient(90deg,#d0342c 0 16.6%,#e8892c 16.6% 33.3%,#e8c92c 33.3% 50%,#4fa84a 50% 66.6%,#3a7fc4 66.6% 83.3%,#7a4fb0 83.3% 100%)',
            }}
          />
        )}

        {/* Lens */}
        <span
          className="absolute rounded-full"
          style={{
            left: geom.lensLeft,
            top: `${geom.lensTop}`,
            width: `${geom.lens}px`,
            height: `${geom.lens}px`,
            border: `1.5px solid ${c.ink}`,
            background: `radial-gradient(circle at 36% 30%, ${c.lensRim} 0 18%, #141416 70%)`,
          }}
        />

        {/* Flash: round on Mini/OneStep, slotted bar on SX-70, rect elsewhere */}
        <span
          className="absolute"
          style={
            shape === 'sx70'
              ? {
                  left: '6px',
                  right: '6px',
                  top: '2px',
                  height: '4px',
                  borderRadius: '1px',
                  background: '#1a1a1c',
                }
              : shape === 'mini' || isOneStep
                ? {
                    right: '5px',
                    top: '6px',
                    width: '11px',
                    height: '11px',
                    borderRadius: '50%',
                    border: `1px solid ${c.ink}`,
                    background: 'radial-gradient(circle at 50% 42%, #fffdf6 0 34%, #dcdcd4 100%)',
                  }
                : {
                    right: '7px',
                    top: '6px',
                    width: '16px',
                    height: '7px',
                    borderRadius: '2px',
                    border: `1px solid ${c.ink}`,
                    background: 'repeating-linear-gradient(0deg,#fbfbf7 0 1.5px,#dcdcd4 1.5px 3px)',
                  }
          }
        />

        {/* Evo's second dial */}
        {isEvo && (
          <span
            className="absolute rounded-full"
            style={{
              right: '6px',
              bottom: '5px',
              width: '7px',
              height: '7px',
              border: `1px solid ${c.ink}`,
              background: `repeating-conic-gradient(${c.plateLo} 0 12deg, ${c.plate} 12deg 24deg)`,
            }}
          />
        )}

        {/* LED */}
        <span
          className="absolute rounded-full"
          style={{
            right: isEvo ? '17px' : '9px',
            bottom: '5px',
            width: '3px',
            height: '3px',
            background: c.accent,
          }}
        />
      </span>

      {/* Shutter nub — a round button on a Mini, a bar elsewhere */}
      <span
        className="absolute"
        style={{
          right: shape === 'sx70' ? '20px' : '11px',
          bottom: `${geom.h}px`,
          width: shape === 'mini' ? '8px' : '10px',
          height: '6px',
          borderRadius: shape === 'mini' ? '50%' : '2px 2px 0 0',
          border: `1.5px solid ${c.ink}`,
          borderBottom: 'none',
          background: `linear-gradient(180deg, ${c.plateHi}, ${c.plateLo})`,
        }}
      />
    </span>
  )
}
