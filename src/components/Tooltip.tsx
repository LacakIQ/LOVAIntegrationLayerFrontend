import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type TooltipProps = {
  content: ReactNode;
  children?: ReactNode;
  className?: string;
  position?: 'top' | 'bottom';
};

export function Tooltip({
  content,
  children,
  className = '',
  position = 'top',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    actualPosition: 'top' | 'bottom';
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipHeight = 44;

    let actualPos = position;
    if (position === 'top' && rect.top - tooltipHeight < 8) {
      actualPos = 'bottom';
    } else if (position === 'bottom' && rect.bottom + tooltipHeight > window.innerHeight - 8) {
      actualPos = 'top';
    }

    const top = actualPos === 'top' ? rect.top - 8 : rect.bottom + 8;
    const left = rect.left + rect.width / 2;

    setCoords({ top, left, actualPosition: actualPos });
  }, [position]);

  useEffect(() => {
    if (!isVisible) return;

    updatePosition();
    const handleScrollOrResize = () => updatePosition();

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isVisible, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="More information"
        onMouseEnter={() => {
          updatePosition();
          setIsVisible(true);
        }}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => {
          updatePosition();
          setIsVisible(true);
        }}
        onBlur={() => setIsVisible(false)}
        onClick={(e) => {
          e.preventDefault();
          updatePosition();
          setIsVisible((prev) => !prev);
        }}
        className={
          children
            ? `inline-flex items-center text-inherit bg-transparent border-0 p-0 outline-none ${className}`
            : `inline-flex items-center text-gray-400 hover:text-gray-600 focus:outline-none focus:text-blue-600 transition-colors p-0.5 rounded cursor-help ${className}`
        }
      >
        {children || <Info size={14} className="shrink-0" />}
      </button>

      {isVisible &&
        coords &&
        createPortal(
          <div
            role="tooltip"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform:
                coords.actualPosition === 'top'
                  ? 'translate(-50%, -100%)'
                  : 'translate(-50%, 0)',
            }}
            className="fixed z-99999 pointer-events-none transition-opacity duration-100"
          >
            <div className="relative w-max max-w-xs rounded-lg bg-gray-900 shadow-2xl">
              <div className="max-h-56 overflow-y-auto px-3 py-1.5 text-xs font-normal leading-relaxed text-white whitespace-normal text-left">
                {content}
              </div>
              <div
                className={`absolute left-1/2 -translate-x-1/2 h-2 w-2 bg-gray-900 rotate-45 pointer-events-none ${
                  coords.actualPosition === 'top' ? '-bottom-1' : '-top-1'
                }`}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default Tooltip;
