import React from 'react';
import { getTeamColor } from '../../utils/teamColors';

const ConstructorCard = ({ constructor, price, selected, onSelect, disabled = false }) => {
  const teamColor = getTeamColor(constructor.team_name);
  
  return (
    <div 
      className={`
        relative rounded-lg border-2 p-4 cursor-pointer transition-all
        ${selected ? 'border-f1-red bg-red-50 scale-105' : 'border-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={() => !disabled && onSelect(constructor)}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-f1-red rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      
      <div className="mb-3">
        <div 
          className="w-full h-3 rounded mb-3"
          style={{ backgroundColor: teamColor }}
        ></div>
        <h4 className="font-bold text-xl text-center">{constructor.team_name}</h4>
      </div>
      
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
        <span className="text-xs text-gray-500">Price</span>
        <span className="font-bold text-f1-red">${(price / 1000000).toFixed(1)}M</span>
      </div>
    </div>
  );
};

export default ConstructorCard;
