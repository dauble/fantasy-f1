import React from 'react';
import { getTeamColor } from '../../utils/teamColors';

const ConstructorCard = ({ constructor, price, selected, onSelect, disabled = false }) => {
  const teamColor = getTeamColor(constructor.team_name);

  return (
    <div
      onClick={() => !disabled && onSelect(constructor)}
      className={`
        relative rounded-xl border border-gray-200 dark:border-f1-border
        bg-white dark:bg-f1-surface
        p-4 cursor-pointer transition-all duration-200 select-none overflow-hidden
        ${selected
          ? 'ring-2 ring-f1-red shadow-lg shadow-f1-red/20 dark:shadow-f1-red/10'
          : 'hover:border-gray-300 dark:hover:border-white/20 hover:shadow-md'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
      `}
    >
      {/* Team color bar across top */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
        style={{ backgroundColor: teamColor }}
      />

      {/* Selected checkmark */}
      {selected && (
        <div className="absolute top-3 right-2.5 w-5 h-5 rounded-full bg-f1-red flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Team name */}
      <div className="mt-3 mb-3 text-center px-6">
        <p className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-wide leading-tight">
          {constructor.team_name}
        </p>
      </div>

      {/* Price row */}
      <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 dark:border-f1-border">
        <span className="text-[10px] text-gray-400 dark:text-f1-muted uppercase tracking-widest font-semibold">
          Price
        </span>
        <span className="font-black text-f1-red text-sm">
          ${(price / 1_000_000).toFixed(1)}M
        </span>
      </div>
    </div>
  );
};

export default ConstructorCard;
