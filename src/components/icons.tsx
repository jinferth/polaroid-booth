/**
 * Inline SVG icon set.
 *
 * Hand-drawn on a 24×24 grid with a consistent 1.6px stroke, so the whole
 * app shares one optical weight. No icon library — the glyphs are part of the
 * analog-photography visual language.
 */

interface IconProps {
  className?: string;
  size?: number;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

/** A classic SLR / instant camera body. */
export function CameraIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2a1 1 0 0 0 .83-.45l.94-1.4A1 1 0 0 1 9.3 3.7h5.4a1 1 0 0 1 .83.45l.94 1.4a1 1 0 0 0 .83.45h1.2A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
      <circle cx="12" cy="12.2" r="3.6" />
      <path d="M17.6 9.4h.01" strokeWidth="2.2" />
    </svg>
  )
}

/** Shutter release button. */
export function ShutterIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  )
}

/** Flip between front and back camera. */
export function FlipIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M3.5 9.5A8.5 8.5 0 0 1 18.4 5.6" />
      <path d="M20.5 14.5A8.5 8.5 0 0 1 5.6 18.4" />
      <path d="M18.6 2.4v3.4h-3.4" />
      <path d="M5.4 21.6v-3.4h3.4" />
    </svg>
  )
}

/** Upload arrow out of a tray. */
export function UploadIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M12 15.5V4" />
      <path d="m7.6 8.4 4.4-4.4 4.4 4.4" />
      <path d="M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17" />
    </svg>
  )
}

/** Download arrow into a tray. */
export function DownloadIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M12 3.5v11" />
      <path d="m7.6 10.6 4.4 4.4 4.4-4.4" />
      <path d="M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17" />
    </svg>
  )
}

/** Share / send. */
export function ShareIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M12 15.5V3.5" />
      <path d="m8.2 7.3 3.8-3.8 3.8 3.8" />
      <path d="M5 13v6.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V13" />
    </svg>
  )
}

/** Trash can. */
export function TrashIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5" />
      <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
      <path d="M10.5 10v6.5M13.5 10v6.5" />
    </svg>
  )
}

/** Restart / retake. */
export function RetakeIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M20.5 11a8.5 8.5 0 1 0-2.1 6" />
      <path d="M20.5 5.5V11H15" />
    </svg>
  )
}

/** Sticker / emoji face. */
export function StickerIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 10h.01M15 10h.01" strokeWidth="2.2" />
      <path d="M8.6 14.4a4.2 4.2 0 0 0 6.8 0" />
    </svg>
  )
}

/** Text / caption pencil. */
export function TextIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M16.4 3.9a2 2 0 0 1 2.8 2.8L8.5 17.4l-4 1.2 1.2-4z" />
      <path d="m14.8 5.5 3.7 3.7" />
    </svg>
  )
}

/** Filter / funnel-ish but drawn as a stack of layers. */
export function FilterIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="6" rx="1.6" />
      <rect x="5.5" y="14" width="13" height="6" rx="1.6" />
    </svg>
  )
}

/** Gallery / grid of photos. */
export function GalleryIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="m3.5 15 4.2-4.2a1.6 1.6 0 0 1 2.2 0l5.3 5.3" />
      <path d="m13.8 13.2 2-2a1.6 1.6 0 0 1 2.2 0l2.5 2.5" />
      <circle cx="15.8" cy="8.6" r="1.4" />
    </svg>
  )
}

/** Sparkle — used for the "developing" state. */
export function SparkleIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z" />
    </svg>
  )
}

/** X / close. */
export function CloseIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

/** Arrow left — back. */
export function ArrowLeftIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m10.5 6.5-5.5 5.5 5.5 5.5" />
    </svg>
  )
}

/** Check mark. */
export function CheckIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  )
}

/** Image / photo. */
export function PhotoIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="8.6" cy="9.6" r="1.6" />
      <path d="m3.5 16.5 4.8-4.8a1.6 1.6 0 0 1 2.2 0l3.5 3.5" />
      <path d="m13.5 14 2.3-2.3a1.6 1.6 0 0 1 2.2 0l2.5 2.5" />
    </svg>
  )
}

/** Countdown timer. */
export function TimerIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 10v3.5l2.3 1.6" />
      <path d="M9.5 2.5h5" />
    </svg>
  )
}
