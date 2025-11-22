import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { XIcon, CheckIcon } from './icons';
import { PLAN_LIMITS } from '../contexts/AuthContext';

interface PricingModalProps {
  onClose: () => void;
}

const PlanFeature: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="flex items-start gap-3">
        <CheckIcon className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
        <span className="text-slate-300">{children}</span>
    </li>
);

const PricingModal: React.FC<PricingModalProps> = ({ onClose }) => {
  const { upgrade, user } = useAuth();

  const handleUpgrade = (plan: 'casual' | 'mastermind') => {
    upgrade(plan);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl w-full max-w-5xl relative animate-fade-in-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-10">
          <XIcon className="w-6 h-6" />
        </button>
        
        <div className="p-8 sm:p-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-2">Choose Your Plan</h2>
            <p className="text-center text-slate-400 mb-10 max-w-2xl mx-auto">Unlock the full power of Clip Genie and take your content creation to the next level.</p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Free Plan */}
                <div className={`border rounded-lg p-6 flex flex-col ${user.plan === 'free' ? 'border-cyan-500' : 'border-slate-700'}`}>
                    <h3 className="text-2xl font-semibold text-white">Free</h3>
                    <p className="text-slate-400 mb-6 h-12">For trying out the basics</p>
                    <p className="text-4xl font-bold text-white mb-6">$0<span className="text-lg font-normal text-slate-400">/month</span></p>
                    <ul className="space-y-4 mb-8 flex-grow">
                        <PlanFeature>Process up to <span className="font-bold text-white">{PLAN_LIMITS.free.videos} videos</span> per month</PlanFeature>
                        <PlanFeature>Videos up to <span className="font-bold text-white">1 hour</span> long ({PLAN_LIMITS.free.videoDuration} minutes)</PlanFeature>
                        <PlanFeature>Generate up to 5 clips per video</PlanFeature>
                    </ul>
                    <button disabled className="w-full mt-auto px-6 py-3 bg-slate-700 text-slate-400 font-bold rounded-full cursor-not-allowed">
                        {user.plan === 'free' ? 'Current Plan' : ' '}
                    </button>
                </div>

                {/* Casual Plan */}
                 <div className={`border rounded-lg p-6 flex flex-col ${user.plan === 'casual' ? 'border-cyan-500' : 'border-slate-700'}`}>
                    <h3 className="text-2xl font-semibold text-white">YouTube Clip Casual</h3>
                    <p className="text-slate-400 mb-6 h-12">For the growing creator</p>
                    <p className="text-4xl font-bold text-white mb-6">$9.99<span className="text-lg font-normal text-slate-400">/month</span></p>
                     <ul className="space-y-4 mb-8 flex-grow">
                        <PlanFeature><span className="font-bold text-white">{PLAN_LIMITS.casual.videos} videos</span> per month</PlanFeature>
                        <PlanFeature>Videos up to <span className="font-bold text-white">3 hours</span> long ({PLAN_LIMITS.casual.videoDuration} minutes)</PlanFeature>
                        <PlanFeature>Generate up to 20 clips per video</PlanFeature>
                    </ul>
                     {user.plan === 'casual' ? (
                         <button disabled className="w-full mt-auto px-6 py-3 bg-slate-700 text-slate-400 font-bold rounded-full cursor-not-allowed">
                            Current Plan
                        </button>
                    ) : (
                        <button onClick={() => handleUpgrade('casual')} className="w-full mt-auto px-6 py-3 bg-cyan-500 text-slate-900 font-bold rounded-full hover:bg-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 transition-all">
                            Upgrade to Casual
                        </button>
                    )}
                </div>

                 {/* Mastermind Plan */}
                 <div className={`border-2 rounded-lg p-6 flex flex-col relative bg-slate-900/50 ${user.plan === 'mastermind' ? 'border-cyan-400' : 'border-slate-600'}`}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 bg-cyan-400 text-slate-900 text-sm font-bold rounded-full">
                        Most Popular
                    </div>
                    <h3 className="text-2xl font-semibold text-cyan-400">YouTube Clip Mastermind</h3>
                    <p className="text-slate-400 mb-6 h-12">For the professional creator and agencies</p>
                    <p className="text-4xl font-bold text-white mb-6">$29.99<span className="text-lg font-normal text-slate-400">/month</span></p>
                     <ul className="space-y-4 mb-8 flex-grow">
                        <PlanFeature><span className="font-bold text-white">{PLAN_LIMITS.mastermind.videos} videos</span> per month</PlanFeature>
                        <PlanFeature>Videos up to <span className="font-bold text-white">8 hours</span> long ({PLAN_LIMITS.mastermind.videoDuration} minutes)</PlanFeature>
                        <PlanFeature>Generate up to 50 clips per video</PlanFeature>
                        <PlanFeature>Priority Support</PlanFeature>
                    </ul>
                    {user.plan === 'mastermind' ? (
                         <button disabled className="w-full mt-auto px-6 py-3 bg-slate-700 text-slate-400 font-bold rounded-full cursor-not-allowed">
                            Current Plan
                        </button>
                    ) : (
                        <button onClick={() => handleUpgrade('mastermind')} className="w-full mt-auto px-6 py-3 bg-cyan-500 text-slate-900 font-bold rounded-full hover:bg-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 transition-all">
                            Upgrade to Mastermind
                        </button>
                    )}
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
