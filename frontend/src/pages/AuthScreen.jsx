import { useState } from 'react';
import { User, Lock, Mail, Phone, Calendar, Image as ImageIcon, Loader } from 'lucide-react';
import api from '../api';

export default function AuthScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form States
  const [formData, setFormData] = useState({
    unique_id: '',
    email: '',
    mobile: '',
    age: '',
    gender: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(''); // Hide error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // --- REAL LOGIN API CALL ---
        const res = await api.post('/auth/login', {
          unique_id: formData.unique_id,
          password: formData.password
        });
        // App.jsx ko user data aur token bhej do
        onLogin(res.data.user, res.data.token);
      } else {
        // --- REAL SIGNUP API CALL ---
        await api.post('/auth/register', formData);
        alert('Account created successfully! Please login.');
        setIsLogin(true); // Signup ke baad login page par bhej do
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-gray-50 flex flex-col items-center justify-center p-6 overflow-y-auto no-scrollbar">
      
      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center p-2 mb-4">
          <img 
            src="/logo.png" 
            alt="ChatVerse Logo" 
            className="w-full h-full object-contain" 
            onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/150?text=Logo'; }}
          />
        </div>
        <h1 className="text-3xl font-bold text-chatverse">ChatVerse</h1>
        <p className="text-gray-500 text-sm mt-1">
          {isLogin ? 'Welcome back, friend!' : 'Create your unique identity'}
        </p>
      </div>

      <div className="w-full bg-white rounded-3xl shadow-sm p-6 border border-gray-100">
        
        {/* Error Message Display */}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl text-center">{error}</div>}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          
          {isLogin ? (
            <>
              <div className="relative">
                <User className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                <input type="text" name="unique_id" value={formData.unique_id} onChange={handleChange} placeholder="Username or Email" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-chatverse focus:ring-1 focus:ring-chatverse transition-all" required />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Password" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-chatverse transition-all" required />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto no-scrollbar pb-2 pr-1">
              <div className="relative">
                <User className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input type="text" name="unique_id" value={formData.unique_id} onChange={handleChange} placeholder="Username (Unique ID)" className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-chatverse" required />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email Address" className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-chatverse" required />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} placeholder="Mobile Number" className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-chatverse" required />
              </div>
              <div className="flex gap-3">
                <div className="relative w-1/2">
                  <Calendar className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <input type="number" name="age" value={formData.age} onChange={handleChange} placeholder="Age" min="13" max="100" className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-chatverse" required />
                </div>
                <div className="relative w-1/2">
                  <select name="gender" value={formData.gender} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-chatverse text-gray-500" required>
                    <option value="" disabled>Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Create Password" className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-chatverse" required />
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-chatverse text-white font-semibold py-3 rounded-xl mt-4 hover:bg-indigo-700 active:scale-95 transition-all shadow-md flex justify-center items-center">
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-chatverse font-bold hover:underline outline-none">
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}