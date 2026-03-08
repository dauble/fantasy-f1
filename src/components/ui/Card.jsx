import React from 'react';

export function Card({ 
  children, 
  className = '', 
  variant = 'default',
  hoverable = false,
  padding = true,
  onClick = null
}) {
  const variants = {
    default: 'bg-white border-gray-200',
    dark: 'bg-gray-800 border-gray-700 text-white',
    primary: 'bg-blue-50 border-blue-200',
    f1: 'bg-gradient-to-br from-red-600 to-red-700 border-red-800 text-white',
  };

  const baseClasses = `
    rounded-lg 
    shadow-md 
    border 
    ${variants[variant]}
    ${hoverable ? 'hover:shadow-xl hover:scale-[1.02] transition-all duration-200' : ''}
    ${padding ? 'p-4 md:p-6' : ''}
    ${onClick ? 'cursor-pointer' : ''}
    ${className}
  `;

  return (
    <div 
      className={baseClasses}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`text-xl md:text-2xl font-bold ${className}`}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`mt-4 pt-4 border-t border-gray-200 ${className}`}>
      {children}
    </div>
  );
}
