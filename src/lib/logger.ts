type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const getLevel = (): number => {
    const level = (process.env.NEXT_PUBLIC_LOG_LEVEL?.toLowerCase() as LogLevel) || 'info';
    return LOG_LEVELS[level] ?? 1;
};

export const logger = {
    debug: (...args: unknown[]) => {
        if (getLevel() <= LOG_LEVELS.debug) {
            console.log('🔍 [DEBUG]', ...args);
        }
    },
    info: (...args: unknown[]) => {
        if (getLevel() <= LOG_LEVELS.info) {
            console.info('ℹ️ [INFO]', ...args);
        }
    },
    warn: (...args: unknown[]) => {
        if (getLevel() <= LOG_LEVELS.warn) {
            console.warn('⚠️ [WARN]', ...args);
        }
    },
    error: (...args: unknown[]) => {
        if (getLevel() <= LOG_LEVELS.error) {
            console.error('❌ [ERROR]', ...args);
        }
    }
};
