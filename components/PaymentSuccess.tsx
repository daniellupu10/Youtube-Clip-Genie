import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CheckIcon } from './icons';

const PaymentSuccess: React.FC = () => {
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirect to home page
          window.location.href = '/';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-xl p-8 text-center animate-fade-in-up">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckIcon className="w-12 h-12 text-white" />
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-bold text-white mb-4">Payment Successful!</h1>
        <p className="text-slate-300 mb-6">
          Thank you for upgrading to the{' '}
          <span className="font-bold text-cyan-400 capitalize">{user.plan}</span> plan!
        </p>

        {/* Benefits */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 mb-6 text-left">
          <h2 className="text-lg font-semibold text-white mb-3">Your new benefits:</h2>
          <ul className="space-y-2 text-slate-300">
            {user.plan === 'casual' && (
              <>
                <li className="flex items-start gap-2">
                  <CheckIcon className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <span>Process up to 10 videos per month</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <span>Videos up to 3 hours long</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <span>Generate up to 20 clips per video</span>
                </li>
              </>
            )}
            {user.plan === 'mastermind' && (
              <>
                <li className="flex items-start gap-2">
                  <CheckIcon className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <span>Process up to 20 videos per month</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <span>Videos up to 8 hours long</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <span>Generate up to 50 clips per video</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <span>Priority support</span>
                </li>
              </>
            )}
          </ul>
        </div>

        {/* Redirect Message */}
        <p className="text-slate-400 text-sm mb-4">
          Redirecting you to the dashboard in <span className="font-bold text-cyan-400">{countdown}</span> seconds...
        </p>

        {/* Manual Redirect Button */}
        <button
          onClick={() => (window.location.href = '/')}
          className="w-full px-6 py-3 bg-cyan-500 text-slate-900 font-bold rounded-full hover:bg-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 transition-all"
        >
          Go to Dashboard Now
        </button>
      </div>
    </div>
  );
};

export default PaymentSuccess;
