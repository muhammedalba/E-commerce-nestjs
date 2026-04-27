import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const BullConfig = BullModule.forRootAsync({
    imports: [ConfigModule],
    useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');

        // 1. إنشاء نسخة الاتصال أولاً حتى نتمكن من التحكم بها
        const redisClient = new Redis(redisUrl!, {
            tls: redisUrl?.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,

            // 2. إضافة استراتيجية إعادة الاتصال عند فشل أو بطء الإنترنت
            retryStrategy: (times) => {
                // زيادة وقت الانتظار تدريجياً بين كل محاولة وأخرى (بحد أقصى 5 ثوانٍ)
                const delay = Math.min(times * 1000, 5000);
                console.warn(`[Redis] محاولة إعادة الاتصال رقم ${times} بعد ${delay} ملي ثانية...`);
                return delay; // إرجاع رقم يعني: "حاول مرة أخرى بعد هذا الوقت" بدلاً من إيقاف السيرفر
            },
        });
        redisClient.on('error', (err) => {
            console.error(`[ error in connected redis ] - ${err.message}`);
        });

        return {
            connection: redisClient,
        };
    },
    inject: [ConfigService],
});
