/**
 * Public API of the camera capture pipeline.
 *
 * ```ts
 * import { useCamera, useCountdown, useShutter } from '@/hooks'
 * ```
 */

export { useCamera } from './useCamera'
export type {
  CameraDevice,
  CameraError,
  CameraFacing,
  CameraStatus,
  UseCameraResult,
} from './useCamera'

export { useCountdown } from './useCountdown'
export type { CountdownOptions, UseCountdownResult } from './useCountdown'

export { useShutter } from './useShutter'
export type { UseShutterResult } from './useShutter'
