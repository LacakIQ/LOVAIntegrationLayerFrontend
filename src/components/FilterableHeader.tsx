import React, { useState, useRef, useEffect } from 'react';
import { Filter, ArrowUpDown } from 'lucide-react';

export function FilterableHeader({ 
  label, 
  options, 
  activeFilter, 
  onFilter 
}: { 
  label: React.ReactNode, 
  options: string[], 
  activeFilter: string | null, 
  onFilter: (val: string | null) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1 cursor-pointer select-none group" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
      <div className="flex items-center gap-1">
        {label}
        <Filter size={12} className={activeFilter ? "text-blue-500" : "text-gray-400 opacity-50 group-hover:opacity-100"} />
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[150px] bg-white border border-gray-200 shadow-xl rounded-lg py-1 z-50 text-left font-normal text-gray-700">
          <div 
             className={`px-4 py-2 text-xs hover:bg-gray-50 ${!activeFilter ? 'bg-blue-50 text-blue-700 font-bold' : ''}`}
             onClick={() => { onFilter(null); setIsOpen(false); }}
          >
            All
          </div>
          {options.map(opt => (
            <div 
              key={opt}
              className={`px-4 py-2 text-xs hover:bg-gray-50 ${activeFilter === opt ? 'bg-blue-50 text-blue-700 font-bold' : ''}`}
              onClick={() => { onFilter(opt); setIsOpen(false); }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
