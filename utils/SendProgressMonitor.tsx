import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface SendProgress {
    total: number;
    pending: number;
    processing: number;
    sent: number;
    error: number;
    recentActivity: Array<{
        client_name: string;
        status: string;
        sent_date?: string;
        error_message?: string;
        retry_count?: number;
    }>;
}

export const SendProgressMonitor: React.FC = () => {
    const [progress, setProgress] = useState<SendProgress | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        let mounted = true;

        const fetchProgress = async () => {
            if (!mounted) return;
            
            try {
                const data = await api.get<SendProgress>('/api/queue/send-progress');
                if (!mounted) return;
                
                setProgress(data);

                if (data && data.total > 0 && (data.processing > 0 || data.pending > 0 || data.sent > 0)) {
                    setIsVisible(true);
                }
            } catch (err) {
                // Silently ignore errors
            }
        };

        const timeout = setTimeout(() => {
            fetchProgress();
            interval = setInterval(fetchProgress, 3000);
        }, 1000);

        return () => {
            mounted = false;
            clearTimeout(timeout);
            if (interval) clearInterval(interval);
        };
    }, []);

    if (!progress) return null;
    if (!isVisible && progress.total === 0) return null;

    const percentage = progress && progress.total > 0 
        ? Math.round((((progress.sent || 0) + (progress.error || 0)) / progress.total) * 100)
        : 0;

    const isActive = progress && progress.processing > 0;

    return (
        <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-blue-500 overflow-hidden cursor-pointer w-[280px]" 
                onClick={() => setIsMinimized(!isMinimized)}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {isActive && (
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        )}
                        <h3 className="text-white font-semibold text-sm">Envio</h3>
                        {isMinimized && progress && (
                            <span className="text-white text-xs">({progress.sent || 0}/{progress.total || 0})</span>
                        )}
                    </div>
                    <span className="material-symbols-outlined text-white text-base">
                        {isMinimized ? 'expand_less' : 'expand_more'}
                    </span>
                </div>

                {/* Progress Bar */}
                {!isMinimized && (
                <div className="p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-green-500 to-blue-500 h-full transition-all duration-500 flex items-center justify-center text-[10px] font-bold text-white"
                                style={{ width: `${percentage}%` }}
                            >
                                {percentage}%
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-1.5">
                        <div className="bg-gray-50 dark:bg-gray-900 rounded p-1.5">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Total</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{progress?.total || 0}</p>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-1.5">
                            <p className="text-[10px] text-yellow-600 dark:text-yellow-400">Pendentes</p>
                            <p className="text-sm font-bold text-yellow-700 dark:text-yellow-300">{progress?.pending || 0}</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-1.5">
                            <p className="text-[10px] text-blue-600 dark:text-blue-400">Processando</p>
                            <p className="text-sm font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                                {progress?.processing || 0}
                                {progress && progress.processing > 0 && (
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                                )}
                            </p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded p-1.5">
                            <p className="text-[10px] text-green-600 dark:text-green-400">Enviados</p>
                            <p className="text-sm font-bold text-green-700 dark:text-green-300">{progress?.sent || 0}</p>
                        </div>
                        {progress && progress.error > 0 && (
                            <div className="bg-red-50 dark:bg-red-900/20 rounded p-1.5 col-span-2">
                                <p className="text-[10px] text-red-600 dark:text-red-400">Erros</p>
                                <p className="text-sm font-bold text-red-700 dark:text-red-300">{progress.error}</p>
                            </div>
                        )}
                    </div>

                    {/* Recent Activity */}
                    {progress.recentActivity && progress.recentActivity.length > 0 && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                            <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Atividade:</p>
                            <div className="space-y-0.5 max-h-24 overflow-y-auto">
                                {progress.recentActivity.map((activity, idx) => (
                                    <div
                                        key={idx}
                                        className={`text-[10px] p-1.5 rounded flex items-center justify-between ${
                                            activity.status === 'SENT'
                                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                                : activity.status === 'ERROR'
                                                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                        }`}
                                    >
                                        <span className="truncate flex-1">{activity.client_name}</span>
                                        <div className="flex items-center gap-1">
                                            {activity.retry_count && activity.retry_count > 0 && (
                                                <span className="text-[10px] bg-orange-200 dark:bg-orange-800 px-1 rounded">
                                                    {activity.retry_count}x
                                                </span>
                                            )}
                                            <span className="material-symbols-outlined text-sm">
                                                {activity.status === 'SENT' ? 'check_circle' : 
                                                 activity.status === 'ERROR' ? 'error' : 'schedule'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                )}
            </div>
        </div>
    );
};
