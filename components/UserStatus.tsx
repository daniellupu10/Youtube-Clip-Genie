import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserIcon } from './icons';
import { PLAN_LIMITS } from '../contexts/AuthContext';
import PricingModal from './PricingModal';

const UserStatus: React.FC = () => {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isPricingModalOpen, setPricingModalOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const getUsageText = () => {
        const remaining = {
            free: PLAN_LIMITS.free.videos - user.usage.videosProcessed,
            casual: PLAN_LIMITS.casual.videos - user.usage.videosProcessed,
            mastermind: PLAN_LIMITS.mastermind.videos - user.usage.videosProcessed,
        };

        switch (user.plan) {
            case 'free':
                return `${Math.max(0, remaining.free)} of ${PLAN_LIMITS.free.videos} videos remaining • Max 1hr per video`;
            case 'casual':
                return `${Math.max(0, remaining.casual)} of ${PLAN_LIMITS.casual.videos} videos remaining • Max 3hrs per video`;
            case 'mastermind':
                return `${Math.max(0, remaining.mastermind)} of ${PLAN_LIMITS.mastermind.videos} videos remaining • Max 8hrs per video`;
            default:
                return '';
        }
    }

    const getProgressPercentage = () => {
        switch (user.plan) {
            case 'free':
                return (user.usage.videosProcessed / PLAN_LIMITS.free.videos) * 100;
            case 'casual':
                 return (user.usage.videosProcessed / PLAN_LIMITS.casual.videos) * 100;
            case 'mastermind':
                return (user.usage.videosProcessed / PLAN_LIMITS.mastermind.videos) * 100;
            default:
                return 0;
        }
    }

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center w-10 h-10 bg-slate-700 rounded-full hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
                <UserIcon className="w-6 h-6 text-slate-300" />
            </button>

            {isOpen && (
                <div className="absolute top-12 right-0 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-20 animate-fade-in-down">
                    <div className="p-4">
                        <p className="text-sm text-slate-400">Welcome, {user.name}!</p>
                        <p className="font-semibold text-white capitalize">{user.plan} Plan</p>
                        <div className="mt-4">
                            <p className="text-xs text-slate-400 mb-1">{getUsageText()} this month</p>
                            <div className="w-full bg-slate-600 rounded-full h-2">
                                <div className="bg-cyan-500 h-2 rounded-full" style={{ width: `${getProgressPercentage()}%` }}></div>
                            </div>
                        </div>

                    </div>
                    <div className="border-t border-slate-700">
                        {user.plan !== 'mastermind' && (
                           <button 
                                onClick={() => {
                                    setPricingModalOpen(true);
                                    setIsOpen(false);
                                }} 
                                className="block w-full text-left px-4 py-2 text-sm text-cyan-400 hover:bg-slate-700/50"
                            >
                                Upgrade Plan
                           </button>
                        )}
                        <button onClick={logout} className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50">
                            Logout
                        </button>
                    </div>
                </div>
            )}
            {isPricingModalOpen && <PricingModal onClose={() => setPricingModalOpen(false)} />}
        </div>
    );
};

export default UserStatus;
