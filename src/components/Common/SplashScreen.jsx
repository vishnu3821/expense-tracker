import React, { useEffect, useState } from 'react';

export default function SplashScreen({ onFinish }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Force transition after exactly 1.5 seconds as requested
    const timer = setTimeout(() => {
      handleFinish();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleFinish = () => {
    setIsExiting(true);
    // Almost immediate transition
    setTimeout(() => {
      onFinish();
    }, 100);
  };

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-200 ease-in-out ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <video
        autoPlay
        muted
        playsInline
        className="max-w-[80%] max-h-[80%] object-contain"
      >
        <source src="/logoanimato.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
