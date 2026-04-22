import React from "react";

export default function LoadingSpinner({ size = "default", className="" }) {
  const sizes = {
    sm: "w-4 h-4",
    default: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${sizes[size]} border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin dark:border-indigo-900/50 dark:border-t-indigo-400`}
      />
    </div>
  );
}