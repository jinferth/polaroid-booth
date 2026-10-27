/**
 * `StickerLayer` — an interactive overlay of draggable / scalable stickers
 * that sits on top of the photo strip.
 *
 * The layer is purely controlled: it renders the `items` it is given and
 * reports every mutation through `onChange` (or `onRemove` for deletions).
 * It never mutates the incoming array.
 *
 * Visual parity with the canvas renderer is guaranteed by importing
 * {@link STICKER_FONT_RATIO} and {@link STICKER_FONT_STACK} from
 * `../lib/stickers` — the glyph is sized with the exact same formula the
 * renderer uses (`scale * width * STICKER_FONT_RATIO`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

import {
  CAPTION_FONT_RATIO,
  STICKER_CAPTION_STACK,
  STICKER_FONT_RATIO,
  STICKER_FONT_STACK,
  STICKER_MAX_SCALE,
  STICKER_MIN_SCALE,
} from '../lib/stickers';
import type { StickerItem, StickerKind } from '../lib/stickers';

/** Props accepted by {@link StickerLayer}. */
export interface StickerLayerProps {
  /** The stickers to render. */
  items: StickerItem[];
  /** Called with the full new list whenever a sticker moves, scales or rotates. */
  onChange: (items: StickerItem[]) => void;
  /** Optional removal hook. When omitted, removals are reported through `onChange`. */
  onRemove?: (id: string) => void;
  /** Pixel width of the strip container (used to derive the glyph size). */
  width: number;
  /** Pixel height of the strip container. */
  height: number;
  /** When true the layer is read-only: no dragging, scaling or deletion. */
  disabled?: boolean;
  /** Extra class applied to the overlay root. */
  className?: string;
}

/** Internal gesture state for the sticker currently being manipulated. */
type GestureKind = 'move' | 'scale' | 'rotate';

/** Snapshot of a gesture, captured on `pointerdown`. */
interface Gesture {
  kind: GestureKind;
  stickerId: string;
  /** Pointer position at gesture start, in client coordinates. */
  startX: number;
  startY: number;
  /** Sticker state at gesture start. */
  originX: number;
  originY: number;
  originScale: number;
  originRotation: number;
  /** Pointer position relative to the container at gesture start. */
  containerX: number;
  containerY: number;
  /** Distance from the container centre to the pointer at gesture start (px). */
  originDistance: number;
}

/** Which small control a pointer gesture targets. */
type HandleKind = 'body' | 'scale' | 'rotate' | 'delete';

const HANDLE_SIZE = 14;
const DELETE_SIZE = 20;
const ROTATE_OFFSET = 26;
/** Normalised units moved by one arrow-key press. */
const KEYBOARD_STEP = 0.01;

/** Clamp a number into the inclusive `[min, max]` range. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Compute the glyph font size for a sticker, mirroring the canvas renderer.
 *
 * Caption stickers use the smaller `CAPTION_FONT_RATIO` because a whole
 * phrase has to fit, so both representations stay in sync.
 *
 * @param scale - The sticker's relative scale.
 * @param width - The sheet container width in pixels.
 * @param kind  - Sticker kind; defaults to `glyph`.
 */
export function stickerDisplayFontSize(
  scale: number,
  width: number,
  kind: StickerKind = 'glyph',
): number {
  const safeScale = Number.isFinite(scale) ? scale : 1;
  if (kind === 'caption') {
    return Math.max(9, safeScale * width * CAPTION_FONT_RATIO);
  }
  return Math.max(8, safeScale * width * STICKER_FONT_RATIO);
}

/**
 * An interactive overlay of stickers positioned over a photo strip.
 */
export function StickerLayer({
  items,
  onChange,
  onRemove,
  width,
  height,
  disabled = false,
  className,
}: StickerLayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  /** Replace a single sticker in the list, preserving order. */
  const updateItem = useCallback(
    (id: string, patch: Partial<StickerItem>) => {
      const next = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
      onChange(next);
    },
    [items, onChange],
  );

  /** Remove a sticker, notifying `onRemove` when provided. */
  const removeItem = useCallback(
    (id: string) => {
      if (onRemove) {
        onRemove(id);
      } else {
        onChange(items.filter((item) => item.id !== id));
      }
      setSelectedId((current) => (current === id ? null : current));
    },
    [items, onChange, onRemove],
  );

  /** Resolve the container-relative pointer position, clamped to the container. */
  const pointerToContainer = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: clamp(clientX - rect.left, 0, rect.width),
        y: clamp(clientY - rect.top, 0, rect.height),
      };
    },
    [],
  );

  /** Begin a drag / scale / rotate gesture. */
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, item: StickerItem, kind: HandleKind) => {
      if (disabled) return;
      if (kind === 'delete') {
        event.stopPropagation();
        removeItem(item.id);
        return;
      }
      if (kind === 'body') {
        setSelectedId(item.id);
      }
      const point = pointerToContainer(event.clientX, event.clientY);
      const rect = containerRef.current?.getBoundingClientRect();
      const centreX = rect ? rect.width / 2 : 0;
      const centreY = rect ? rect.height / 2 : 0;
      const dx = point.x - centreX;
      const dy = point.y - centreY;

      event.stopPropagation();
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort; dragging still works via window listeners.
      }
      gestureRef.current = {
        kind: kind === 'scale' ? 'scale' : kind === 'rotate' ? 'rotate' : 'move',
        stickerId: item.id,
        startX: event.clientX,
        startY: event.clientY,
        originX: item.x,
        originY: item.y,
        originScale: item.scale,
        originRotation: item.rotation,
        containerX: point.x,
        containerY: point.y,
        originDistance: Math.hypot(dx, dy),
      };
    },
    [disabled, pointerToContainer, removeItem],
  );

  /** Continue the active gesture. */
  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || disabled) return;
      const point = pointerToContainer(event.clientX, event.clientY);

      if (gesture.kind === 'move') {
        const deltaX = (point.x - gesture.containerX) / Math.max(1, width);
        const deltaY = (point.y - gesture.containerY) / Math.max(1, height);
        updateItem(gesture.stickerId, {
          x: clamp(gesture.originX + deltaX, 0, 1),
          y: clamp(gesture.originY + deltaY, 0, 1),
        });
        return;
      }

      if (gesture.kind === 'scale') {
        const rect = containerRef.current?.getBoundingClientRect();
        const centreX = rect ? rect.width / 2 : 0;
        const centreY = rect ? rect.height / 2 : 0;
        const distance = Math.hypot(point.x - centreX, point.y - centreY);
        if (gesture.originDistance < 1) return;
        const nextScale = clamp(
          gesture.originScale * (distance / gesture.originDistance),
          STICKER_MIN_SCALE,
          STICKER_MAX_SCALE,
        );
        updateItem(gesture.stickerId, { scale: nextScale });
        return;
      }

      // Rotate: angle around the container centre.
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const centreX = rect.width / 2;
      const centreY = rect.height / 2;
      const angle = Math.atan2(point.y - centreY, point.x - centreX);
      const base = Math.atan2(
        gesture.containerY - centreY,
        gesture.containerX - centreX,
      );
      updateItem(gesture.stickerId, {
        rotation: gesture.originRotation + (angle - base),
      });
    },
    [disabled, height, pointerToContainer, updateItem, width],
  );

  /** Finish the active gesture. */
  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    gestureRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore — the capture may already have been released.
    }
  }, []);

  /** Keyboard support: arrows nudge, Delete/Backspace removes. */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, item: StickerItem) => {
      if (disabled) return;
      const step = event.shiftKey ? KEYBOARD_STEP * 5 : KEYBOARD_STEP;
      switch (event.key) {
        case 'ArrowLeft':
          updateItem(item.id, { x: clamp(item.x - step, 0, 1) });
          break;
        case 'ArrowRight':
          updateItem(item.id, { x: clamp(item.x + step, 0, 1) });
          break;
        case 'ArrowUp':
          updateItem(item.id, { y: clamp(item.y - step, 0, 1) });
          break;
        case 'ArrowDown':
          updateItem(item.id, { y: clamp(item.y + step, 0, 1) });
          break;
        case 'Delete':
        case 'Backspace':
          removeItem(item.id);
          break;
        case 'Escape':
          setSelectedId(null);
          break;
        default:
          return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [disabled, removeItem, updateItem],
  );

  /** Clear the selection when clicking the empty background. */
  const handleBackgroundPointerDown = useCallback(() => {
    setSelectedId(null);
  }, []);

  /** Remove the keyboard focus ring reliance on mouse clicks. */
  useEffect(() => {
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [items, selectedId]);

  const rootStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={rootStyle}
      onPointerDown={handleBackgroundPointerDown}
      aria-label="贴纸图层"
      role="group"
    >
      {items.map((item) => {
        const isSelected = selectedId === item.id;
        const isHovered = hoveredId === item.id;
        const showHandle = !disabled && (isSelected || isHovered);
        const isCaption = item.kind === 'caption';
        const fontSize = stickerDisplayFontSize(item.scale, width, item.kind ?? 'glyph');

        const stickerStyle: CSSProperties = {
          position: 'absolute',
          left: `${item.x * 100}%`,
          top: `${item.y * 100}%`,
          transform: `translate(-50%, -50%) rotate(${item.rotation}rad) scale(${item.scale})`,
          transformOrigin: 'center center',
          fontSize: `${fontSize}px`,
          fontFamily: isCaption ? STICKER_CAPTION_STACK : STICKER_FONT_STACK,
          fontWeight: isCaption ? 700 : 400,
          lineHeight: isCaption ? 1.22 : 1,
          whiteSpace: isCaption ? 'pre' : 'nowrap',
          textAlign: isCaption ? 'center' : 'left',
          // Caption stickers render as an outlined bubble, mirroring the canvas.
          ...(isCaption
            ? {
                padding: `${fontSize * 0.46}px ${fontSize * 0.62}px`,
                borderRadius: `${Math.min(fontSize * 0.9, fontSize * 0.55 * 2)}px`,
                background: item.fill ?? '#ffffff',
                border: `${Math.max(1.2, fontSize * 0.1)}px solid ${item.stroke ?? '#1b1815'}`,
                color: item.color ?? '#1b1815',
                boxShadow: `0 ${fontSize * 0.08}px ${fontSize * 0.22}px rgba(0,0,0,0.22)`,
              }
            : {}),
          cursor: disabled ? 'default' : 'grab',
          touchAction: 'none',
        };

        return (
          <div
            key={item.id}
            style={stickerStyle}
            onPointerDown={(event) => handlePointerDown(event, item, 'body')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerEnter={() => setHoveredId(item.id)}
            onPointerLeave={() => setHoveredId((current) => (current === item.id ? null : current))}
            onDoubleClick={() => {
              if (!disabled) removeItem(item.id);
            }}
            onKeyDown={(event) => handleKeyDown(event, item)}
            tabIndex={disabled ? -1 : 0}
            role="button"
            aria-label={`贴纸 ${item.glyph}`}
            aria-roledescription="可拖动贴纸"
            data-sticker-id={item.id}
          >
            <span aria-hidden="true">{item.glyph}</span>

            {showHandle ? (
              <>
                {/* Delete button */}
                <button
                  type="button"
                  aria-label={`删除贴纸 ${item.glyph}`}
                  onPointerDown={(event) => handlePointerDown(event, item, 'delete')}
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: `${-DELETE_SIZE / 2}px`,
                    left: `${-DELETE_SIZE / 2}px`,
                    width: `${DELETE_SIZE}px`,
                    height: `${DELETE_SIZE}px`,
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: `${Math.max(10, DELETE_SIZE * 0.62)}px`,
                    lineHeight: 1,
                    background: '#d94f4f',
                    color: '#fff',
                    border: '2px solid #fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                    cursor: 'pointer',
                    transform: 'scale(0.6)',
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>

                {/* Rotation handle — appears above the sticker. */}
                <span
                  aria-hidden="true"
                  onPointerDown={(event) => handlePointerDown(event, item, 'rotate')}
                  style={{
                    position: 'absolute',
                    bottom: `${ROTATE_OFFSET}px`,
                    left: '50%',
                    width: `${HANDLE_SIZE}px`,
                    height: `${HANDLE_SIZE}px`,
                    marginLeft: `${-HANDLE_SIZE / 2}px`,
                    borderRadius: '9999px',
                    background: '#ffffff',
                    border: '2px solid #4a3b52',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                    cursor: 'grab',
                  }}
                />

                {/* Scale handle — bottom-right corner grip. */}
                <span
                  aria-hidden="true"
                  onPointerDown={(event) => handlePointerDown(event, item, 'scale')}
                  style={{
                    position: 'absolute',
                    bottom: `${-HANDLE_SIZE / 2}px`,
                    right: `${-HANDLE_SIZE / 2}px`,
                    width: `${HANDLE_SIZE}px`,
                    height: `${HANDLE_SIZE}px`,
                    borderRadius: '9999px',
                    background: '#4a3b52',
                    border: '2px solid #fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                    cursor: 'nwse-resize',
                  }}
                />
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default StickerLayer;
