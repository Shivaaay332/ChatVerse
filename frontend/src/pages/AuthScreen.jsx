import { useState } from 'react';
import { Mail, Lock, User, Phone, Fingerprint, Eye, EyeOff, Loader } from 'lucide-react';
import api from '../api';

export default function AuthScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    unique_id: '', username: '', email: '', mobile: '', password: '', gender: 'Male'
  });
  const [error, setError] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [valErrors, setValErrors] = useState({});

  const handleUniqueIdChange = (e) => {
    const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setFormData({ ...formData, unique_id: sanitized });
    if (valErrors.unique_id) setValErrors({ ...valErrors, unique_id: null });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (valErrors[e.target.name]) setValErrors({ ...valErrors, [e.target.name]: null });
  };

  const validateForm = () => {
    const errors = {};
    if (!isLogin) {
      if (formData.unique_id.length < 3) errors.unique_id = 'Must be at least 3 chars.';
      if (formData.username.trim().length < 2) errors.username = 'Name is required.';
      if (formData.mobile && !/^\d{10}$/.test(formData.mobile)) errors.mobile = 'Enter valid 10-digit number.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Enter a valid email.';
    if (formData.password.length < 6) errors.password = 'Must be at least 6 chars.';
    
    setValErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin ? { email: formData.email, password: formData.password } : formData;
      const res = await api.post(endpoint, payload);
      onLogin(res.data.user, res.data.token);
    } catch (err) {
      if (isLogin) {
        setError('Invalid email or password.');
      } else {
        const backendError = err.response?.data?.error || 'Registration failed.';
        if (backendError.toLowerCase().includes('exists')) {
           setError('Account with this email or ID already exists.');
        } else {
           setError('An unexpected error occurred. Please try again.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAuth = () => {
    setIsLogin(!isLogin);
    setError('');
    setValErrors({});
  };

  return (
    <div className="h-full w-full bg-white dark:bg-gray-900 flex flex-col transition-colors relative overflow-y-auto no-scrollbar">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col items-center justify-center pt-[12vh] pb-8 px-6">
        <div className="w-20 h-20 bg-gradient-to-tr from-chatverse to-purple-500 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-500/30 transform rotate-12 mb-6">
          <div className="w-10 h-10 border-[4px] border-white rounded-full -rotate-12"></div>
        </div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight text-center">
          {isLogin ? 'Welcome Back!' : 'Create Account'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-[14px] font-medium mt-2 text-center">
          {isLogin ? 'Enter your details to access your chats' : 'Join ChatVerse and connect instantly'}
        </p>
      </div>

      {/* FORM SECTION */}
      <form onSubmit={handleSubmit} className="flex-1 px-6 flex flex-col gap-4 pb-12">
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-500 border border-red-200 dark:border-red-800 text-[13px] font-bold px-4 py-3 rounded-2xl text-center">
            {error}
          </div>
        )}

        {!isLogin && (
          <>
            <div className="flex flex-col gap-1">
              <div className="relative">
                <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text" name="unique_id" value={formData.unique_id} onChange={handleUniqueIdChange} 
                  placeholder="Unique ID (e.g. rahul_99)"
                  className={`w-full bg-gray-50 dark:bg-gray-800 border ${valErrors.unique_id ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'} text-gray-900 dark:text-white px-12 py-3.5 rounded-2xl outline-none focus:border-chatverse dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30 transition-all font-semibold placeholder-gray-400`}
                />
              </div>
              {valErrors.unique_id && <span className="text-red-500 text-[11px] font-bold pl-2">{valErrors.unique_id}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text" name="username" value={formData.username} onChange={handleChange} 
                  placeholder="Full Name"
                  className={`w-full bg-gray-50 dark:bg-gray-800 border ${valErrors.username ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'} text-gray-900 dark:text-white px-12 py-3.5 rounded-2xl outline-none focus:border-chatverse dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30 transition-all font-semibold placeholder-gray-400`}
                />
              </div>
              {valErrors.username && <span className="text-red-500 text-[11px] font-bold pl-2">{valErrors.username}</span>}
            </div>
          </>
        )}

        <div className="flex flex-col gap-1">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="email" name="email" value={formData.email} onChange={handleChange} 
              placeholder="Email Address"
              className={`w-full bg-gray-50 dark:bg-gray-800 border ${valErrors.email ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'} text-gray-900 dark:text-white px-12 py-3.5 rounded-2xl outline-none focus:border-chatverse dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30 transition-all font-semibold placeholder-gray-400`}
            />
          </div>
          {valErrors.email && <span className="text-red-500 text-[11px] font-bold pl-2">{valErrors.email}</span>}
        </div>

        {!isLogin && (
          <div className="flex flex-col gap-1">
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="tel" name="mobile" value={formData.mobile} onChange={handleChange} 
                placeholder="Mobile Number"
                className={`w-full bg-gray-50 dark:bg-gray-800 border ${valErrors.mobile ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'} text-gray-900 dark:text-white px-12 py-3.5 rounded-2xl outline-none focus:border-chatverse dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30 transition-all font-semibold placeholder-gray-400`}
              />
            </div>
            {valErrors.mobile && <span className="text-red-500 text-[11px] font-bold pl-2">{valErrors.mobile}</span>}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type={showPassword ? "text" : "password"} 
              name="password" value={formData.password} onChange={handleChange} 
              placeholder="Password"
              className={`w-full bg-gray-50 dark:bg-gray-800 border ${valErrors.password ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'} text-gray-900 dark:text-white pl-12 pr-12 py-3.5 rounded-2xl outline-none focus:border-chatverse dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/30 transition-all font-semibold placeholder-gray-400`}
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {valErrors.password && <span className="text-red-500 text-[11px] font-bold pl-2">{valErrors.password}</span>}
        </div>

        {!isLogin && (
          <div className="flex flex-col gap-2 mt-1">
            <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider pl-1">Gender</span>
            <div className="flex items-center gap-2">
              {['Male', 'Female', 'Other'].map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: g })}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-[13px] transition-all border ${formData.gender === g ? 'bg-chatverse text-white border-chatverse shadow-md shadow-indigo-500/20' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        <button 
          type="submit" 
          disabled={isLoading}
          className={`mt-4 w-full text-white font-black py-4 rounded-2xl transition-all flex justify-center items-center gap-2 shadow-xl shadow-indigo-500/20 ${isLoading ? 'bg-indigo-400 scale-[0.98]' : 'bg-chatverse hover:bg-indigo-700 active:scale-[0.98]'}`}
        >
          {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
        </button>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          <span className="text-gray-500 dark:text-gray-400 font-medium text-[14px]">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
          </span>
          <button 
            type="button" 
            onClick={toggleAuth} 
            disabled={isLoading}
            className="text-chatverse dark:text-indigo-400 font-black text-[14px] hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
        
      </form>
    </div>
  );
}