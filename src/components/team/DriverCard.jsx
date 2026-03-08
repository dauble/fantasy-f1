import React from 'react';
import { getDriverColor } from '../../utils/teamColors';

const DriverCard = ({ driver, price, selected, onSelect, disabled = false }) => {
  const teamColor = getDriverColor(driver.team_name);
  
  return (
    <div 
      className={`
        relative rounded-lg border-2 p-4 cursor-pointer transition-all
        ${selected ? 'border-f1-red bg-red-50 scale-105' : 'border-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={() => !disabled && onSelect(driver)}
      style={{ borderLeftWidth: '6px', borderLeftColor: teamColor }}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-f1-red rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-shrink-0">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: teamColor }}
          >
            {driver.driver_number}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-lg truncate">
            {driver.full_name || `${driver.first_name} ${driver.last_name}`}
          </h4>
          <p className="text-sm text-gray-600 truncate">{driver.team_name}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
        <span className="text-xs text-gray-500">Price</span>
        <span className="font-bold text-f1-red">${(price / 1000000).toFixed(1)}M</span>
      </div>
    </div>
  );
};

export default DriverCard;
