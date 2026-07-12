import { useState, useEffect } from 'react';
import { Lock, Delete } from 'lucide-react';

export default function AppLockScreen({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const CORRECT_PIN = localStorage.getItem('chatverse_pin') || '1234';

  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      setPin((prev) => prev + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === CORRECT_PIN) {
        onUnlock(); 
      } else {
        setError(true);
        setTimeout(() => setPin(''), 500); 
      }
    }
  }, [pin, onUnlock, CORRECT_PIN]);

  return (
    <div className="h-full w-full bg-chatverse flex flex-col items-center justify-between py-12 px-6">
      
      <div className="flex flex-col items-center mt-10">
        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-6">
          <Lock className="text-white w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">App Locked</h2>
        <p className="text-indigo-200 text-sm">Enter your 4-digit PIN</p>

        <div className={`flex gap-4 mt-8 ${error ? 'animate-bounce' : ''}`}>
          {[...Array(4)].map((_, i) => (
            <div 
              key={i} 
              className={`w-4 h-4 rounded-full transition-all duration-300 ${
                i < pin.length ? 'bg-white scale-110' : 'bg-white/30'
              } ${error ? 'bg-red-400' : ''}`}
            />
          ))}
        </div>
        {error && <p className="text-red-300 text-sm mt-4">Incorrect PIN, try again.</p>}
      </div>

      <div className="w-full max-w-[280px] grid grid-cols-3 gap-y-6 gap-x-8 mb-8">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button 
            key={num}
            onClick={() => handleKeyPress(num.toString())}
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white font-medium hover:bg-white/10 active:bg-white/20 transition-colors mx-auto"
          >
            {num}
          </button>
        ))}
        
        <div></div> 

        <button 
          onClick={() => handleKeyPress('0')}
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-white font-medium hover:bg-white/10 active:bg-white/20 transition-colors mx-auto"
        >
          0
        </button>

        <button 
          onClick={handleDelete}
          className="w-16 h-16 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:bg-white/20 transition-colors mx-auto"
        >
          <Delete className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}