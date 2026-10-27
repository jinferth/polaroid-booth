import { useCallback } from 'react'

import { BodyShelf } from './BodyShelf'
import { CameraShell } from './CameraShell'
import { ArrowLeftIcon } from './icons'
import { getBody, type CameraBody } from '../lib/bodies'
import { SIMULATIONS, type SimId } from '../lib/fuji'

interface StudioViewProps {
  /** Fired once every photo of the session has been taken. */
  onCaptured: (shots: string[]) => void
  /** Go back to the previous screen. */
  onBack: () => void
  /** The active film simulation. */
  sim: SimId
  /** Change the film simulation. */
  onSimChange: (sim: SimId) => void
  /** The fitted camera body id. */
  bodyId: string
  /** Change the camera body. */
  onBodyChange: (bodyId: string) => void
}

/**
 * The capture screen.
 *
 * A physical instant camera plus the shop counter you pick it from. Choosing a
 * body also adopts that body's default film simulation — the way different
 * bodies have different colour characters.
 */
export function StudioView({
  onCaptured,
  onBack,
  sim,
  onSimChange,
  bodyId,
  onBodyChange,
}: StudioViewProps) {
  const body = getBody(bodyId)
  const active = SIMULATIONS.find((s) => s.id === sim) ?? SIMULATIONS[0]!

  /** Picking a body also adopts its default film simulation. */
  const handleSelectBody = useCallback(
    (next: CameraBody) => {
      onBodyChange(next.id)
      onSimChange(next.defaultSim)
    },
    [onBodyChange, onSimChange],
  )

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-16 pt-6">
      {/* --- Header ------------------------------------------------------- */}
      <header className="mb-6 grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <button className="btn btn-ghost btn-sm justify-self-start" onClick={onBack} type="button">
          <ArrowLeftIcon size={16} />
          返回
        </button>
        <div className="text-center">
          <p className="stamp inline-block">STUDIO · 取景室</p>
          <h2 className="font-display mt-1.5 text-2xl font-semibold tracking-tight md:text-3xl">
            按下快门
          </h2>
        </div>
        <span className="stamp justify-self-end">{body.name}</span>
      </header>

      <CameraShell onComplete={onCaptured} sim={sim} onSimChange={onSimChange} body={body} />

      {/* --- The camera-shop counter ------------------------------------- */}
      <BodyShelf selectedId={bodyId} onSelect={handleSelectBody} />

      {/* --- Film simulation rail ---------------------------------------- */}
      <section className="mx-auto mt-8 w-full max-w-3xl">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            胶片模拟 · FILM SIMULATION
          </h3>
          <p className="text-xs text-ink-soft">
            <span className="font-medium text-ink">{active.name}</span>
            <span className="mx-1.5 text-ink-faint">·</span>
            {active.blurb}
          </p>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {SIMULATIONS.map((s) => {
            const selected = s.id === sim
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSimChange(s.id)}
                aria-pressed={selected}
                title={s.blurb}
                className={`group flex shrink-0 flex-col items-center gap-1.5 rounded-lg px-2.5 py-2 transition-all duration-200 ${
                  selected
                    ? 'bg-fuji-black text-white shadow-[0_3px_0_rgba(14,14,16,0.9)]'
                    : 'bg-paper text-ink-soft hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_4px_12px_rgba(60,45,30,0.14)]'
                }`}
              >
                <span
                  className="h-6 w-6 rounded-full ring-1 ring-black/15 transition-transform duration-200 group-hover:scale-110"
                  style={{ background: s.swatch }}
                />
                <span className="whitespace-nowrap font-mono text-[9px] tracking-[0.06em]">
                  {s.name}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
