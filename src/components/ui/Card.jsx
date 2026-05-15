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
    default: 'bg-white dark:bg-f1-surface border-gray-200 dark:border-f1-border text-gray-900 dark:text-white',
    dark: 'bg-f1-surface border-f1-border text-white',
    primary: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
    f1: 'bg-gradient-to-br from-f1-red to-f1-red-dark border-f1-red-dark text-white',
  };

  const baseClasses = `
    rounded-xl
    shadow-sm
    border
    ${variants[variant]}
    ${hoverable ? 'hover:shadow-lg hover:border-f1-red/40 transition-all duration-200 cursor-pointer' : ''}
    ${padding ? 'p-4 md:p-5' : ''}
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
    <h3 className={`text-lg md:text-xl font-black uppercase tracking-wide ${className}`}>
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
    <div className={`mt-4 pt-4 border-t border-gray-200 dark:border-f1-border ${className}`}>
      {children}
    </div>
  );
}
