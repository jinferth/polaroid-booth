import { useCallback, useEffect, useState } from 'react'

import { EditorView } from './components/EditorView'
import { GalleryView, type SavedStrip } from './components/GalleryView'
import { StudioView } from './components/StudioView'
import { CameraIcon, SparkleIcon } from './components/icons'
import { DEFAULT_BODY_ID, getBody } from './lib/bodies'
import { DEFAULT_SIM, SIMULATIONS, type SimId } from './lib/fuji'

/** The screens the app moves between. */
type Screen = 'home' | 'studio' | 'editor' | 'gallery'

/** Where a saved strip is persisted. */
const STORAGE_KEY = 'polaroid-booth.strips.v1'

/** Where the chosen camera body is persisted. */
const BODY_KEY = 'polaroid-booth.body.v1'

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [shots, setShots] = useState<string[]>([])
  const [strips, setStrips] = useState<SavedStrip[]>([])
  const [sim, setSim] = useState<SimId>(DEFAULT_SIM)
  const [bodyId, setBodyId] = useState<string>(DEFAULT_BODY_ID)

  // Restore the chosen body on first load.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BODY_KEY)
      if (saved && getBody(saved).id === saved) setBodyId(saved)
    } catch {
      /* storage unavailable — keep the default */
    }
  }, [])

  // Persist the body choice.
  useEffect(() => {
    try {
      localStorage.setItem(BODY_KEY, bodyId)
    } catch {
      /* storage full or blocked — the choice still works in-session */
    }
  }, [bodyId])

  // Restore the album from local storage on first load.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setStrips(
            parsed.filter(
              (s): s is SavedStrip =>
                typeof s === 'object' &&
                s !== null &&
                typeof (s as SavedStrip).id === 'string' &&
                typeof (s as SavedStrip).dataUrl === 'string',
            ),
          )
        }
      }
    } catch {
      /* corrupt or unavailable storage — start with an empty album */
    }
  }, [])

  // Persist the album whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(strips))
    } catch {
      /* storage full or blocked — the album still works in-memory */
    }
  }, [strips])

  const handleCaptured = useCallback((captured: string[]) => {
    setShots(captured)
    setScreen('editor')
  }, [])

  const handleFinish = useCallback((dataUrl: string, caption: string) => {
    const strip: SavedStrip = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      dataUrl,
      caption,
      createdAt: Date.now(),
    }
    setStrips((prev) => [strip, ...prev])
    setShots([])
    setScreen('gallery')
  }, [])

  const handleDelete = useCallback((id: string) => {
    setStrips((prev) => prev.filter((s) => s.id !== id))
  }, [])

  return (
    <div className="relative min-h-screen">
      {/* --- Ambient background blobs ----------------------------------- */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="drift absolute -left-24 top-24 h-80 w-80 rounded-full bg-amber/10 blur-3xl" />
        <div
          className="drift absolute -right-20 bottom-32 h-96 w-96 rounded-full bg-sage/12 blur-3xl"
          style={{ animationDelay: '-8s' }}
        />
        <div
          className="drift absolute left-1/3 top-2/3 h-72 w-72 rounded-full bg-plum/8 blur-3xl"
          style={{ animationDelay: '-14s' }}
        />
      </div>

      <div className="relative z-10">
        {/* --- Home / landing ------------------------------------------- */}
        {screen === 'home' && (
          <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
            <div className="text-center">
              <p className="stamp mb-5 inline-block">EST. 2026 · INSTANT FILM</p>

              <h1 className="font-display text-balance text-[clamp(2.75rem,9vw,6rem)] font-semibold leading-[0.92] tracking-tight">
                拍立得
                <span className="block text-amber">照相馆</span>
              </h1>

              <p className="mx-auto mt-6 max-w-md text-balance text-[15px] leading-relaxed text-ink-soft">
                打开镜头，连拍四张 —— 或者直接上传。
                <br />
                它们会像真的相纸一样，慢慢从灰白里显影出来。
              </p>

              {/* Film simulation swatches */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
                {SIMULATIONS.filter((s) => s.id !== 'none')
                  .slice(0, 9)
                  .map((s) => (
                    <span
                      key={s.id}
                      title={`${s.name} · ${s.blurb}`}
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10 transition-transform duration-200 hover:scale-150"
                      style={{ background: s.swatch }}
                    />
                  ))}
                <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                  13 种胶片模拟
                </span>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  className="btn btn-accent px-7 py-3 text-base"
                  onClick={() => setScreen('studio')}
                  type="button"
                >
                  <CameraIcon size={19} />
                  开始拍照
                </button>
                <button
                  className="btn btn-ghost px-6 py-3"
                  onClick={() => setScreen('gallery')}
                  type="button"
                >
                  <SparkleIcon size={17} />
                  我的相册{strips.length > 0 ? ` (${strips.length})` : ''}
                </button>
              </div>
            </div>

            {/* Three feature cards */}
            <div className="mt-20 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
              {[
                {
                  n: '01',
                  t: '连拍四张',
                  d: '倒计时三秒，自动抓拍四个瞬间，像真的证件照机那样。',
                },
                {
                  n: '02',
                  t: '慢慢显影',
                  d: '照片会从灰白一点点泛出颜色，那是最像真的瞬间。',
                },
                {
                  n: '03',
                  t: '贴纸与手写',
                  d: '给相纸加一个表情，写一句话，再下载成高清 PNG。',
                },
              ].map((f) => (
                <div key={f.n} className="paper-card group p-6 transition-transform duration-300 hover:-translate-y-1">
                  <span className="font-mono text-[11px] tracking-[0.2em] text-amber">{f.n}</span>
                  <h3 className="font-display mt-3 text-xl font-semibold">{f.t}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{f.d}</p>
                </div>
              ))}
            </div>

            <p className="mt-16 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              照片只保存在你自己的浏览器里
            </p>
          </main>
        )}

        {screen === 'studio' && (
          <StudioView
            onCaptured={handleCaptured}
            onBack={() => setScreen('home')}
            sim={sim}
            onSimChange={setSim}
            bodyId={bodyId}
            onBodyChange={setBodyId}
          />
        )}

        {screen === 'editor' && (
          <EditorView
            photos={shots}
            onBack={() => setScreen('studio')}
            onFinish={handleFinish}
            sim={sim}
            onSimChange={setSim}
          />
        )}

        {screen === 'gallery' && (
          <GalleryView
            strips={strips}
            onNew={() => {
              setShots([])
              setScreen('studio')
            }}
            onDelete={handleDelete}
            onRestore={setStrips}
          />
        )}
      </div>
    </div>
  )
}

export default App
